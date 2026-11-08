"""Tiger Cloud features.

Unit tests run everywhere: the roadmap builder runs against a fake connection
that serves rows from db/seed/pathways.json. The integration test at the bottom
seeds a real database and only runs with TIGER_TESTS=1 (it writes to DATABASE_URL).
"""

import os
from contextlib import asynccontextmanager

import pytest
from fastapi.testclient import TestClient

from app.data import MAJORS
from app.main import app
from app.services import db, pathways
from scripts.seed import SCHEMA, load_pathways, schema_statements

DATA = load_pathways()


class FakeConn:
    """Answers the builder's queries from pathways.json, matched by table name."""

    def __init__(self):
        certs = {c[0]: c for c in DATA["certifications"]}
        self.courses = {c[0]: c for c in DATA["courses"]}
        self.cert_by_id = certs

    def _course_rows(self, slug):
        prog = DATA["programs"].get(slug)
        if not prog:
            return []
        rows = []
        for t, term in enumerate(prog["terms"], start=1):
            rows += [("sequence", t, code, note) for code, note in term]
        rows += [("common_prereq", 0, code, None) for code in prog["common_prereqs"]]
        out = []
        for req, term, code, note in rows:
            _, title, credits, cert = self.courses[code]
            out.append({"requirement": req, "term": term, "course_code": code, "note": note, "title": title,
                        "credits": credits, "cert_name": self.cert_by_id[cert][1] if cert else None})
        return out

    async def fetchrow(self, sql, slug):
        if "FROM majors" in sql:
            m = next((m for m in MAJORS if m["slug"] == slug), None)
            return m and {"name": m["name"], "mdc_program": m["mdc_program"], "mdc_url": m["mdc_url"]}
        if "FROM program_sources" in sql:
            p = DATA["programs"].get(slug)
            return p and {"source_url": p["source_url"], "effective_term": p["effective_term"]}
        raise AssertionError(sql)

    async def fetch(self, sql, slug):
        if "FROM program_courses" in sql:
            return self._course_rows(slug)
        if "FROM major_certifications" in sql:
            return [dict(zip(("id", "name", "issuer", "why", "source_url"), self.cert_by_id[cid]), timing=timing)
                    for cid, timing in DATA["major_certifications"].get(slug, [])]
        if "FROM transfer_options" in sql:
            return [dict(zip(("institution", "program", "notes", "source_url"), t))
                    for t in DATA["transfer_options"].get(slug, [])]
        if "FROM major_careers" in sql:
            careers = {c[0]: c for c in DATA["careers"]}
            keys = ("soc_code", "title", "median_pay", "outlook", "entry_education", "source_url")
            return [dict(zip(keys, careers[s]), pay_year=2025, outlook_period="2025-35")
                    for s in DATA["major_careers"].get(slug, [])]
        raise AssertionError(sql)


class FakePool:
    @asynccontextmanager
    async def acquire(self):
        yield FakeConn()


@pytest.fixture
def fake_db(monkeypatch):
    monkeypatch.setattr(db, "pool", FakePool())


def _check_tree(roadmap):
    ids = {s.id for s in roadmap.steps}
    assert len(ids) == len(roadmap.steps), "duplicate step ids"
    for s in roadmap.steps:
        assert set(s.depends_on) <= ids, f"{s.id} depends on a missing step"
        assert s.source_url, f"{s.id} has no source"
    # every career is reachable from enrollment
    deps = {s.id: s.depends_on for s in roadmap.steps}

    def reaches_enroll(i, seen=()):
        return i == "enroll" or any(reaches_enroll(d, seen + (i,)) for d in deps[i] if d not in seen)

    for s in roadmap.steps:
        assert reaches_enroll(s.id), s.id


@pytest.mark.parametrize("slug", [m["slug"] for m in MAJORS])
async def test_every_major_builds_a_sourced_tree(fake_db, slug):
    roadmap = await pathways.build_roadmap(slug)
    _check_tree(roadmap)
    assert any(s.stage == "career" for s in roadmap.steps)


async def test_cybersecurity_tree_details(fake_db):
    r = await pathways.build_roadmap("cybersecurity")
    by_id = {s.id: s for s in r.steps}
    assert [s.id for s in r.steps if s.id.startswith("term-")] == [f"term-{i}" for i in range(1, 6)]
    assert by_id["term-1"].detail == "4 courses, 15 credits"
    assert sum(c.credits for s in r.steps if s.id.startswith("term-") for c in s.courses) == 60
    # Security+ hangs off the semester with CTS 1120; CySA+ off semester 4
    assert by_id["cert-comptia-security-plus"].depends_on == ["term-1"]
    assert by_id["cert-comptia-cysa-plus"].depends_on == ["term-4"]
    career = by_id["career-15-1212"]
    assert "$129,180" in career.detail and career.depends_on == ["transfer-0"]


async def test_nursing_license_gates_the_career(fake_db):
    r = await pathways.build_roadmap("nursing")
    by_id = {s.id: s for s in r.steps}
    assert by_id["cert-nclex-rn"].depends_on == ["coursework"]  # right after the A.S., before the BSN
    assert by_id["career-29-1141"].depends_on == ["cert-nclex-rn", "cert-fl-rn-license"]


async def test_architecture_has_transfer_prereqs(fake_db):
    r = await pathways.build_roadmap("architecture")
    by_id = {s.id: s for s in r.steps}
    assert [c.code for c in by_id["transfer-prereqs"].courses][:2] == ["ARC 2303", "ARC 2304"]
    assert by_id["transfer-0"].depends_on == ["term-5", "transfer-prereqs"]


def test_all_programs_total_60_credits():
    credits = {c[0]: c[2] for c in DATA["courses"]}
    for slug, prog in DATA["programs"].items():
        assert sum(credits[code] for term in prog["terms"] for code, _ in term) == 60, slug


def test_schema_splits_into_statements():
    stmts = schema_statements(SCHEMA.read_text(encoding="utf-8"))
    assert any("create_hypertable" in s for s in stmts)
    assert any("timescaledb.continuous" in s for s in stmts)
    assert all(";" not in s for s in stmts)


def test_endpoints_without_database():
    with TestClient(app) as c:
        assert c.get("/courses/CTS1120/prerequisites").status_code == 404
        assert c.get("/insights").status_code == 503
        assert c.post("/quiz/step", json={"answers": [{"question_id": "q_math", "value": 0}]}).status_code == 200
        assert c.get("/roadmap/nursing").json()["generated_by"].startswith("fallback")


# ---------------------------------------------------------------- real database (opt-in)

@pytest.mark.skipif(os.getenv("TIGER_TESTS") != "1", reason="set TIGER_TESTS=1 to run against DATABASE_URL")
def test_against_tiger_cloud():
    import asyncio

    from scripts.seed import main as seed

    assert asyncio.run(seed(skip_embeddings=True)) == 0
    with TestClient(app) as c:
        assert c.get("/health").json()["integrations"]["catalog_source"] == "tiger"
        r = c.get("/roadmap/cybersecurity").json()
        assert r["generated_by"].startswith("Tiger Cloud") and len(r["steps"]) > 8

        chain = c.get("/courses/MAC 2313/prerequisites").json()
        assert [p["code"] for p in chain][:1] == ["MAC 2312"] and {"MAC 1105"} <= {p["code"] for p in chain}

        c.post("/quiz/step", json={"answers": [{"question_id": "q_math", "value": 0}]}, headers={"X-Quiz-Session": "pytest"})
    with TestClient(app) as c:  # new client: the background insert from the last one has landed
        ins = c.get("/insights").json()
        assert ins["steps_24h"] >= 1
