"""Quiz analytics on a TimescaleDB hypertable.

Every scored quiz step is written to quiz_events in the background (it never
slows or breaks the quiz). /insights reads it back with time_bucket and the
quiz_daily_matches continuous aggregate.
"""

import asyncio
import logging

from app.data import FIELDS, QUESTIONS
from app.schemas import Answer, Insights, QuizStep
from app.services import db
from app.services.matching import match

log = logging.getLogger(__name__)

_pending: set[asyncio.Task] = set()  # keep references so tasks aren't garbage-collected mid-flight


def log_step(answers: list[Answer], step: QuizStep, session_id: str | None) -> None:
    if not db.pool or not step.top_matches:
        return
    last = answers[-1] if answers else None
    top = step.top_matches[0]
    task = asyncio.create_task(_insert(
        session_id[:64] if session_id else None, len(answers),
        last.question_id[:64] if last else None, last.value if last else None,
        top.slug, top.score, step.depth, step.done,
    ))
    _pending.add(task)
    task.add_done_callback(_pending.discard)


async def drain() -> None:
    """Wait for in-flight inserts (called on shutdown, before the pool closes)."""
    if _pending:
        await asyncio.gather(*_pending, return_exceptions=True)


async def _insert(*values) -> None:
    try:
        await db.pool.execute(
            "INSERT INTO quiz_events (session_id, n_answers, question_id, option_idx, top_slug, top_score, depth, done) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            *values,
        )
    except Exception as e:
        log.warning("Could not log quiz event: %s", e)


def _label(question_id: str, idx: int) -> str | None:
    q = next((q for q in QUESTIONS if q["id"] == question_id), None)
    return q["options"][idx]["label"] if q and 0 <= idx < len(q["options"]) else None


async def insights() -> Insights | None:
    if not db.pool:
        return None
    async with db.pool.acquire() as conn:
        steps_24h = await conn.fetchval("SELECT count(*) FROM quiz_events WHERE time > now() - INTERVAL '24 hours'")
        daily = await conn.fetch(
            "SELECT top_slug, sum(completions)::int AS n FROM quiz_daily_matches "
            "WHERE day > now() - INTERVAL '7 days' GROUP BY top_slug ORDER BY n DESC"
        )
        hourly = await conn.fetch(
            "SELECT time_bucket(INTERVAL '1 hour', time) AS hour, count(*)::int AS steps FROM quiz_events "
            "WHERE time > now() - INTERVAL '24 hours' GROUP BY hour ORDER BY hour"
        )
        answers = await conn.fetch(
            "SELECT question_id, option_idx, count(*)::int AS n FROM quiz_events "
            "WHERE time > now() - INTERVAL '7 days' AND question_id IS NOT NULL "
            "GROUP BY question_id, option_idx ORDER BY n DESC LIMIT 10"
        )
    finished = sum(r["n"] for r in daily)
    return Insights(
        steps_24h=steps_24h,
        finished_7d=finished,
        top_matches_7d=[match(r["top_slug"], r["n"] / finished) for r in daily if r["top_slug"] in FIELDS][:5],
        hourly_steps_24h=[{"hour": r["hour"].isoformat(), "steps": r["steps"]} for r in hourly],
        popular_answers=[
            {"question_id": r["question_id"], "option_idx": r["option_idx"],
             "label": _label(r["question_id"], r["option_idx"]), "count": r["n"]}
            for r in answers
        ],
    )
