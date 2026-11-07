"""Turns a student's answers into a Gemini embedding and finds the closest fields.

Student text is embedded as RETRIEVAL_QUERY and field descriptions as
RETRIEVAL_DOCUMENT. When Tiger Cloud is connected and majors.embedding is
filled (run `python -m scripts.embed_majors`), ranking happens in Postgres with
pgvector; otherwise the field vectors are computed once and ranked in memory.
"""

import asyncio
import logging

from app.data import FIELDS, MAJORS, TRAIT_DESCRIPTIONS
from app.schemas import Answer, FieldMatch, SemanticMatch
from app.services import db, gemini
from app.services.matching import match, resolve_answer

log = logging.getLogger(__name__)

_MAJORS = {m["slug"]: m for m in MAJORS}
_field_vectors: dict[str, list[float]] | None = None
_lock = asyncio.Lock()


def field_document(slug: str) -> str:
    """The text that represents a field in vector space."""
    f, m = FIELDS[slug], _MAJORS.get(slug, {})
    strong = [t for t, w in sorted(f["profile"].items(), key=lambda kv: -kv[1]) if w >= 0.7]
    parts = [
        f"{f['name']} ({m.get('field', '')}).",
        m.get("summary", ""),
        f"Starts at Miami Dade College with: {m['mdc_program']}." if m.get("mdc_program") else "",
        "Suits someone who is " + "; ".join(TRAIT_DESCRIPTIONS[t] for t in strong) + "." if strong else "",
    ]
    return " ".join(p for p in parts if p)


def profile_text(answers: list[Answer], free_text: str | None = None) -> str:
    """The student's answers as prose, which embeds far better than raw option indexes."""
    lines = [f"Asked \"{r[0]}\", they chose \"{r[1]}\"." for a in answers if (r := resolve_answer(a))]
    if free_text and free_text.strip():
        lines.append(f"In their own words: {free_text.strip()}")
    return "A student describing their interests and preferences. " + " ".join(lines) if lines else ""


async def _memory_vectors() -> dict[str, list[float]] | None:
    global _field_vectors
    async with _lock:
        if _field_vectors is None:
            slugs = list(FIELDS)
            vecs = await gemini.embed([field_document(s) for s in slugs], "RETRIEVAL_DOCUMENT")
            if vecs:
                _field_vectors = dict(zip(slugs, vecs))
    return _field_vectors


async def _rank_pgvector(vec: list[float], k: int) -> list[FieldMatch] | None:
    if not db.pool:
        return None
    try:
        rows = await db.pool.fetch(
            "SELECT slug, 1 - (embedding <=> $1) AS similarity FROM majors "
            "WHERE embedding IS NOT NULL ORDER BY embedding <=> $1 LIMIT $2",
            vec,
            k,
        )
    except Exception as e:
        log.warning("pgvector query failed, ranking in memory instead: %s", e)
        return None
    return [match(r["slug"], r["similarity"]) for r in rows if r["slug"] in FIELDS] or None


async def semantic_match(answers: list[Answer], free_text: str | None = None, k: int = 5) -> SemanticMatch | None:
    """None when there's nothing to embed or Gemini is unavailable."""
    text = profile_text(answers, free_text)
    if not text:
        return None
    vecs = await gemini.embed([text], "RETRIEVAL_QUERY")
    if not vecs:
        return None
    vec = vecs[0]

    if ranked := await _rank_pgvector(vec, k):
        return SemanticMatch(matches=ranked, backend="pgvector", profile_text=text)

    fields = await _memory_vectors()
    if not fields:
        return None
    scores = sorted(((s, gemini.cosine(vec, v)) for s, v in fields.items()), key=lambda kv: -kv[1])
    return SemanticMatch(matches=[match(s, sc) for s, sc in scores[:k]], backend="memory", profile_text=text)
