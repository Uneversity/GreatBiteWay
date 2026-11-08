"""Official MDC facts: coverage of every major, sources, and which facts land on which step.

Run from api/:  python -m pytest
"""

import pytest
from fastapi.testclient import TestClient

from app import mdc_info
from app.data import MAJORS
from app.main import app
from app.schemas import RoadmapStep
from app.services import elaborate, gemini


def step(id: str, stage: str, title: str = "Step", detail: str = "") -> RoadmapStep:
    return RoadmapStep(id=id, stage=stage, title=title, detail=detail, duration="")


def test_every_major_has_sourced_programs():
    for m in MAJORS:
        info = mdc_info.MAJORS[m["slug"]]
        assert info.programs, m["slug"]
        for p in info.programs:
            assert p.source_url.startswith("https://www.mdc.edu/"), (m["slug"], p.code)
            assert p.credits >= 60 and p.effective_term
            if p.admission:
                assert (p.admission_url or "").startswith("https://www.mdc.edu/")
            if p.notes:
                assert p.notes_url


def test_enroll_step_gets_application_and_fafsa():
    facts = mdc_info.facts_for_step("cybersecurity", step("enroll", "mdc", "Enroll at MDC"))
    text = " ".join(f.value for f in facts)
    assert "$30" in text and "West E40469" in text and "25079" in text
    assert all(f.source_url for f in facts)


def test_fallback_enroll_step_is_recognized_by_title():
    facts = mdc_info.facts_for_step("architecture", step("s1", "mdc", "Enroll at MDC"))
    assert any(f.label == "Apply" for f in facts)


def test_coursework_step_gets_lower_division_tuition():
    facts = {f.label: f.value for f in mdc_info.facts_for_step("psychology", step("coursework", "mdc"))}
    assert "$118.22" in facts["Tuition + fees"] and "$402.51" in facts["Tuition + fees"]
    assert "$7,093" in facts["Estimated cost"]  # 60 credits x $118.22


def test_mdc_bachelors_step_uses_upper_division_rate_and_admission():
    s = step("transfer-0", "transfer", "B.S. in Nursing (RN to BSN)", "Miami Dade College. Finish the A.S.")
    facts = mdc_info.facts_for_step("nursing", s)
    labels = [f.label for f in facts]
    assert facts[0].value.startswith("B.S. Bachelor of Science in Nursing") and "Admission" in labels
    est = next(f.value for f in facts if f.label == "Estimated cost")
    assert "$5,455" in est and "42 upper-division" in est  # 42 x $129.89


def test_transfer_out_of_an_as_without_matching_bachelors_gets_nothing():
    s = step("transfer-0", "transfer", "B.S. Mechanical Engineering", "Florida International University")
    assert mdc_info.facts_for_step("graphic-design", s) == []
    aa = mdc_info.facts_for_step("mechanical-engineering", s)
    assert any("guarantees admission" in f.value for f in aa)


def test_certification_and_career_get_only_matching_notes():
    cert = [f.value for f in mdc_info.facts_for_step("nursing", step("cert-x", "certification"))]
    assert any("NCLEX" in v for v in cert) and not any("Medical Campus" in v for v in cert)
    career = [f.value for f in mdc_info.facts_for_step("psychology", step("career-x", "career"))]
    assert career and all("doctorate" in v or "master's" in v for v in career)


def test_unknown_major_gets_only_general_enrollment_facts():
    assert mdc_info.facts_for_step("nope", step("term-1", "mdc")) == []
    assert mdc_info.facts_for_step(None, step("enroll", "mdc"))


# --- through the API -------------------------------------------------------------

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def reset_cache():
    elaborate._cache.clear()


ELABORATION = {
    "headline": "Your first two years", "overview": "Core classes at MDC.",
    "specs": [], "what_to_expect": ["Classes"], "how_to_prepare": ["Apply"],
    "questions_to_ask": ["Which classes transfer?"], "leads_to": "Transfer.",
}


def test_elaborate_sends_mdc_facts_to_gemini_and_the_page(client, monkeypatch):
    async def none(*_a, **_k):
        return None

    monkeypatch.setattr(gemini, "generate_json", none)
    roadmap = client.get("/roadmap/psychology").json()
    sid = next(s["id"] for s in roadmap["steps"] if s["id"] != "s1" and s["stage"] == "mdc")

    seen = {}

    async def fake(prompt, schema, **_k):
        seen["prompt"] = prompt
        return schema.model_validate(ELABORATION)

    monkeypatch.setattr(gemini, "generate_json", fake)
    body = client.post("/roadmap/elaborate", json={"roadmap": roadmap, "step_id": sid}).json()
    assert "Official MDC facts" in seen["prompt"] and "$118.22" in seen["prompt"]
    assert body["mdc_checked_on"] == mdc_info.CHECKED_ON
    assert any(f["label"] == "Tuition + fees" and f["source_url"] == mdc_info.TUITION_URL for f in body["mdc_facts"])
