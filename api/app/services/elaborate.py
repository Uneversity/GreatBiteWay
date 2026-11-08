"""Gemini takes a closer look at one step of a roadmap.

Used by the side panel that opens when a student clicks a step. The step is
sent with the career goal and its neighbours (what comes before and after) so
the answer fits the journey. Gemini may add general, well-known context about
this kind of step, but is told not to invent specific numbers, dates, prices or
course codes that aren't in the roadmap. Results are cached in memory.
"""

import hashlib
import json
from collections import OrderedDict

from pydantic import BaseModel

from app.config import get_settings
from app.schemas import Roadmap, StepElaboration, StepFact
from app.services import gemini

_CACHE_SIZE = 512
_cache: OrderedDict[str, StepElaboration] = OrderedDict()

MAX_ITEMS = 5


class _GenFact(BaseModel):
    label: str
    value: str


class _GenElaboration(BaseModel):
    headline: str
    overview: str
    specs: list[_GenFact]
    what_to_expect: list[str]
    how_to_prepare: list[str]
    questions_to_ask: list[str]
    leads_to: str


SYSTEM = """You are a friendly academic advisor at Miami Dade College (MDC) talking to a student
who may be the first in their family to go to college. The student clicked ONE step of their roadmap
and wants to know more about it.

Write in plain English: short sentences, everyday words, about an 8th-grade reading level. Talk to the
student as "you". Spell out every acronym the first time.

Facts:
- Facts in the roadmap (course codes, durations, pay, school names) are true: use them.
- You may add general, widely known context about this kind of step (what a licensing exam is like,
  what transferring involves, what the job is day to day).
- Do NOT invent specific numbers, deadlines, prices, pass rates, course codes or school names that are
  not in the roadmap. When something varies, say so and tell the student who to ask.

Fields:
- headline: one short line that captures this step (under 12 words).
- overview: 2-4 sentences on what this step is and why it matters in this journey.
- specs: 3-5 quick facts as label/value pairs (for example Format, Typical length, Where, Who it's for,
  Cost). Keep each value under 15 words.
- what_to_expect: 3-5 bullets on what the student will actually do or experience.
- how_to_prepare: 3-5 concrete bullets on how to get ready or succeed.
- questions_to_ask: 2-4 questions to bring to an MDC advisor about this step.
- leads_to: 1-2 sentences on how finishing this step sets up what comes next (or, for a final career
  step, where the career can go from here)."""


def _prompt(roadmap: Roadmap, step_id: str) -> str:
    by_id = {s.id: s for s in roadmap.steps}
    step = by_id[step_id]
    before = [by_id[d].model_dump() for d in step.depends_on if d in by_id]
    after = [s.model_dump() for s in roadmap.steps if step_id in s.depends_on]
    parts = [
        f"Career goal: {roadmap.career}",
        f"Whole journey: {roadmap.summary}",
        f"THE STEP TO EXPLAIN (JSON):\n{json.dumps(step.model_dump(), indent=1)}",
        f"Steps that come right before it (JSON):\n{json.dumps(before, indent=1)}",
        f"Steps that come right after it (JSON):\n{json.dumps(after, indent=1)}",
    ]
    if roadmap.explanation:
        note = next((n.note for n in roadmap.explanation.step_notes if n.id == step_id), None)
        if note:
            parts.append(f"Short note the student already sees: {note}")
    return "\n\n".join(parts)


def _key(roadmap: Roadmap, step_id: str) -> str:
    blob = json.dumps(
        [get_settings().gemini_model, roadmap.career, [s.model_dump() for s in roadmap.steps], step_id],
        sort_keys=True,
    )
    return hashlib.sha256(blob.encode()).hexdigest()


def _clean(items: list[str]) -> list[str]:
    return [i.strip() for i in items if i and i.strip()][:MAX_ITEMS]


async def elaborate_step(roadmap: Roadmap, step_id: str) -> StepElaboration | None:
    """None when the step isn't in the roadmap or Gemini is unavailable."""
    if step_id not in {s.id for s in roadmap.steps}:
        return None
    key = _key(roadmap, step_id)
    if key in _cache:
        _cache.move_to_end(key)
        return _cache[key]

    gen = await gemini.generate_json(_prompt(roadmap, step_id), _GenElaboration, system=SYSTEM, temperature=0.3, fast=True)
    if not gen or not gen.overview.strip():
        return None

    result = StepElaboration(
        step_id=step_id,
        headline=gen.headline.strip(),
        overview=gen.overview.strip(),
        specs=[StepFact(label=f.label.strip(), value=f.value.strip()) for f in gen.specs if f.label.strip() and f.value.strip()][:MAX_ITEMS],
        what_to_expect=_clean(gen.what_to_expect),
        how_to_prepare=_clean(gen.how_to_prepare),
        questions_to_ask=_clean(gen.questions_to_ask),
        leads_to=gen.leads_to.strip(),
        generated_by="Gemini",
    )
    _cache[key] = result
    if len(_cache) > _CACHE_SIZE:
        _cache.popitem(last=False)
    return result
