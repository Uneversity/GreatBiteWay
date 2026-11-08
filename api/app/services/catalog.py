"""Loads the majors and quiz bank from Tiger Cloud at startup.

app/data.py stays the seed and the offline fallback. When the database has a
complete catalog, its rows replace the in-memory lists in place, so every module
that imported FIELDS / MAJORS / QUESTIONS sees the database version.
"""

import logging

import asyncpg

from app.data import FIELDS, MAJORS, QUESTIONS, TRAITS
from app.services import db, embeddings

log = logging.getLogger(__name__)

source = "data.py"  # or "tiger", reported by /health


async def load_from_db() -> bool:
    global source
    if not db.pool:
        return False
    try:
        majors = await db.pool.fetch(
            "SELECT slug, name, field, mdc_program, summary, mdc_url, profile FROM majors ORDER BY sort, name"
        )
        options = await db.pool.fetch(
            "SELECT q.id, q.text, o.idx, o.label, o.traits FROM quiz_questions q "
            "JOIN quiz_options o ON o.question_id = q.id ORDER BY q.sort, o.idx"
        )
    except (asyncpg.UndefinedTableError, asyncpg.UndefinedColumnError):
        log.warning("Catalog tables missing; run `python -m scripts.seed`. Using app/data.py.")
        return False

    # A profile missing a trait would break scoring, so only complete rows count.
    usable = [m for m in majors if isinstance(m["profile"], dict) and set(TRAITS) <= set(m["profile"])]
    if not usable or not options:
        log.warning("Catalog empty or incomplete in the database; run `python -m scripts.seed`. Using app/data.py.")
        return False

    questions: dict[str, dict] = {}
    for r in options:
        q = questions.setdefault(r["id"], {"id": r["id"], "text": r["text"], "options": []})
        q["options"].append({"label": r["label"], "traits": {t: float(w) for t, w in r["traits"].items() if t in TRAITS}})

    MAJORS[:] = [{k: m[k] for k in ("slug", "name", "field", "mdc_program", "summary", "mdc_url")} for m in usable]
    FIELDS.clear()
    FIELDS.update({m["slug"]: {"name": m["name"], "profile": {t: float(m["profile"][t]) for t in TRAITS}} for m in usable})
    QUESTIONS[:] = list(questions.values())
    embeddings.reset()
    source = "tiger"
    log.info("Loaded %d majors and %d questions from Tiger Cloud", len(MAJORS), len(QUESTIONS))
    return True
