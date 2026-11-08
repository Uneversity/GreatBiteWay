"""Set up Tiger Cloud: apply db/schema.sql, load the catalog and roadmap data, embed majors.

Run from api/ (needs DATABASE_URL in .env; GEMINI_API_KEY is optional):
    python -m scripts.seed                  # everything
    python -m scripts.seed --skip-embeddings

Idempotent: re-running refreshes every row from app/data.py and db/seed/pathways.json.
"""

import argparse
import asyncio
import json
import re
import sys
from pathlib import Path

from pgvector.asyncpg import register_vector

from app.data import FIELDS, MAJORS, QUESTIONS, TRAIT_DESCRIPTIONS, TRAITS
from app.services import db, gemini
from app.services.embeddings import field_document

API_DIR = Path(__file__).resolve().parents[1]
SCHEMA = API_DIR / "db" / "schema.sql"
PATHWAYS = API_DIR / "db" / "seed" / "pathways.json"
BLS_PAY_YEAR, BLS_OUTLOOK_PERIOD = 2025, "2025-35"


def schema_statements(sql: str) -> list[str]:
    """Split on semicolons that end a line. The schema has no function bodies, so this is safe."""
    sql = re.sub(r"--[^\n]*", "", sql)
    return [s.strip() for s in re.split(r";\s*\n", sql) if s.strip()]


def load_pathways() -> dict:
    """Read pathways.json and check every reference, so a typo fails before touching the DB."""
    data = json.loads(PATHWAYS.read_text(encoding="utf-8"))
    courses = {c[0] for c in data["courses"]}
    certs = {c[0] for c in data["certifications"]}
    socs = {c[0] for c in data["careers"]}
    errors = []
    for slug, prog in data["programs"].items():
        codes = [code for term in prog["terms"] for code, _ in term] + prog["common_prereqs"]
        errors += [f"{slug}: unknown course {c}" for c in codes if c not in courses]
    for course, req in data["prerequisites"]:
        errors += [f"prereq: unknown course {c}" for c in (course, req) if c not in courses]
    errors += [f"course {c[0]}: unknown cert {c[3]}" for c in data["courses"] if c[3] and c[3] not in certs]
    for table, known in (("major_careers", socs), ("major_certifications", certs)):
        for slug, refs in data[table].items():
            ids = [r if isinstance(r, str) else r[0] for r in refs]
            errors += [f"{table}.{slug}: unknown {i}" for i in ids if i not in known]
    for table in ("programs", "major_careers", "major_certifications", "transfer_options"):
        errors += [f"{table}: unknown major {s}" for s in data[table] if s not in FIELDS]
    if errors:
        raise ValueError("pathways.json has bad references:\n  " + "\n  ".join(errors))
    return data


async def seed_catalog(conn) -> None:
    await conn.executemany(
        "INSERT INTO traits (name, description, sort) VALUES ($1, $2, $3) "
        "ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, sort = EXCLUDED.sort",
        [(t, TRAIT_DESCRIPTIONS[t], i) for i, t in enumerate(TRAITS)],
    )
    await conn.executemany(
        """
        INSERT INTO majors (slug, name, field, mdc_program, summary, mdc_url, profile, sort)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name, field = EXCLUDED.field, mdc_program = EXCLUDED.mdc_program,
            summary = EXCLUDED.summary, mdc_url = EXCLUDED.mdc_url, profile = EXCLUDED.profile, sort = EXCLUDED.sort
        """,
        [(m["slug"], m["name"], m["field"], m["mdc_program"], m["summary"], m.get("mdc_url"),
          FIELDS[m["slug"]]["profile"], i) for i, m in enumerate(MAJORS)],
    )
    await conn.execute("DELETE FROM majors WHERE slug <> ALL($1::text[])", [m["slug"] for m in MAJORS])

    await conn.execute("DELETE FROM quiz_questions")  # cascades to options
    await conn.executemany(
        "INSERT INTO quiz_questions (id, text, sort) VALUES ($1, $2, $3)",
        [(q["id"], q["text"], i) for i, q in enumerate(QUESTIONS)],
    )
    await conn.executemany(
        "INSERT INTO quiz_options (question_id, idx, label, traits) VALUES ($1, $2, $3, $4)",
        [(q["id"], i, o["label"], o["traits"]) for q in QUESTIONS for i, o in enumerate(q["options"])],
    )


async def seed_pathways(conn, data: dict) -> None:
    for table in ("program_courses", "program_sources", "prerequisites", "major_careers",
                  "major_certifications", "transfer_options"):
        await conn.execute(f"DELETE FROM {table}")

    await conn.executemany(
        "INSERT INTO certifications (id, name, issuer, why, source_url) VALUES ($1, $2, $3, $4, $5) "
        "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, issuer = EXCLUDED.issuer, "
        "why = EXCLUDED.why, source_url = EXCLUDED.source_url",
        data["certifications"],
    )
    await conn.executemany(
        "INSERT INTO courses (code, title, credits, prepares_for) VALUES ($1, $2, $3, $4) "
        "ON CONFLICT (code) DO UPDATE SET title = EXCLUDED.title, credits = EXCLUDED.credits, "
        "prepares_for = EXCLUDED.prepares_for",
        data["courses"],
    )
    await conn.executemany("INSERT INTO prerequisites (course_code, requires) VALUES ($1, $2)", data["prerequisites"])

    rows, sources = [], []
    for slug, prog in data["programs"].items():
        sources.append((slug, prog["source_url"], prog["effective_term"]))
        for t, term in enumerate(prog["terms"], start=1):
            rows += [(slug, "sequence", t, i, code, note) for i, (code, note) in enumerate(term)]
        rows += [(slug, "common_prereq", 0, i, code, None) for i, code in enumerate(prog["common_prereqs"])]
    await conn.executemany(
        "INSERT INTO program_courses (major_slug, requirement, term, position, course_code, note) "
        "VALUES ($1, $2, $3, $4, $5, $6)", rows)
    await conn.executemany(
        "INSERT INTO program_sources (major_slug, source_url, effective_term) VALUES ($1, $2, $3)", sources)

    await conn.executemany(
        """
        INSERT INTO careers (soc_code, title, median_pay, pay_year, outlook, outlook_period, entry_education, source_url)
        VALUES ($1, $2, $3, $7, $4, $8, $5, $6)
        ON CONFLICT (soc_code) DO UPDATE SET title = EXCLUDED.title, median_pay = EXCLUDED.median_pay,
            pay_year = EXCLUDED.pay_year, outlook = EXCLUDED.outlook, outlook_period = EXCLUDED.outlook_period,
            entry_education = EXCLUDED.entry_education, source_url = EXCLUDED.source_url
        """,
        [(*c, BLS_PAY_YEAR, BLS_OUTLOOK_PERIOD) for c in data["careers"]],
    )
    await conn.executemany(
        "INSERT INTO major_careers (major_slug, soc_code, position) VALUES ($1, $2, $3)",
        [(slug, soc, i) for slug, socs in data["major_careers"].items() for i, soc in enumerate(socs)],
    )
    await conn.executemany(
        "INSERT INTO major_certifications (major_slug, cert_id, timing, position) VALUES ($1, $2, $3, $4)",
        [(slug, cid, timing, i) for slug, cs in data["major_certifications"].items()
         for i, (cid, timing) in enumerate(cs)],
    )
    await conn.executemany(
        "INSERT INTO transfer_options (major_slug, position, institution, program, notes, source_url) "
        "VALUES ($1, $2, $3, $4, $5, $6)",
        [(slug, i, *opt) for slug, opts in data["transfer_options"].items() for i, opt in enumerate(opts)],
    )


async def seed_embeddings(conn) -> int:
    slugs = [m["slug"] for m in MAJORS]
    vecs = await gemini.embed([field_document(s) for s in slugs], "RETRIEVAL_DOCUMENT")
    if not vecs:
        return 0
    await conn.executemany("UPDATE majors SET embedding = $2 WHERE slug = $1", list(zip(slugs, vecs)))
    return len(vecs)


async def main(skip_embeddings: bool) -> int:
    data = load_pathways()
    await db.connect()
    if not db.pool:
        print("DATABASE_URL is not set in api/.env")
        return 1
    try:
        async with db.pool.acquire() as conn:
            for stmt in schema_statements(SCHEMA.read_text(encoding="utf-8")):
                await conn.execute(stmt)
            print("Schema applied")
            await register_vector(conn)  # the extension may have just been created
            async with conn.transaction():
                await seed_catalog(conn)
                await seed_pathways(conn, data)
            print(f"Loaded {len(MAJORS)} majors, {len(QUESTIONS)} questions, {len(data['courses'])} courses, "
                  f"{len(data['careers'])} careers, {len(data['certifications'])} certifications")
            if skip_embeddings:
                print("Skipped embeddings")
            elif not gemini.available():
                print("Skipped embeddings (no GEMINI_API_KEY); /quiz/semantic will rank in memory")
            else:
                n = await seed_embeddings(conn)
                print(f"Embedded {n} majors ({gemini.EMBED_DIM} dims)" if n else "Gemini embedding failed")
        return 0
    finally:
        await db.disconnect()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--skip-embeddings", action="store_true")
    sys.exit(asyncio.run(main(parser.parse_args().skip_embeddings)))
