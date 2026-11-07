"""Gemini writes a plain-English explanation of a roadmap.

Gemini is told to explain only what's in the roadmap (no invented courses,
dates or salaries). Step notes are matched back to real step ids and anything
else is dropped. Results are cached in memory because the roadmap page is
server-rendered on every request.
"""

import hashlib
import json
from collections import OrderedDict

from pydantic import BaseModel

from app.config import get_settings
from app.schemas import Answer, Roadmap, RoadmapExplanation, StepNote
from app.services import gemini
from app.services.matching import resolve_answer

_CACHE_SIZE = 256
_cache: OrderedDict[str, RoadmapExplanation] = OrderedDict()


class _GenNote(BaseModel):
    id: str
    note: str


class _GenExplanation(BaseModel):
    summary: str
    step_notes: list[_GenNote]
    first_move: str


SYSTEM = """You are a friendly academic advisor at Miami Dade College (MDC) talking to a student
who may be the first in their family to go to college.

Explain the roadmap you are given in plain English:
- Short sentences, everyday words, about an 8th-grade reading level. Talk to the student as "you".
- Spell out every acronym the first time (for example A.A. = Associate in Arts, A.S. = Associate in Science,
  B.A.S. = Bachelor of Applied Science, 2+2 = two years at MDC then two at a university).
- Use ONLY facts in the roadmap. Do not invent course codes, deadlines, prices, salaries or school names.
- summary: 2-3 sentences on the whole journey and roughly how long it takes.
- step_notes: one entry per step, using the step's exact id; 1-2 sentences on what it is and why it matters.
- first_move: one concrete thing the student can do this week to get started.
- If you are told about the student's interests, connect the pathway to them in the summary."""


def _prompt(roadmap: Roadmap, interests: list[str]) -> str:
    steps = [s.model_dump() for s in roadmap.steps]
    prompt = f"Career goal: {roadmap.career}\n\nRoadmap steps (JSON):\n{json.dumps(steps, indent=1)}"
    if interests:
        prompt += "\n\nWhat the student told us in the quiz:\n" + "\n".join(f"- {i}" for i in interests)
    return prompt


def _key(roadmap: Roadmap, interests: list[str]) -> str:
    blob = json.dumps(
        [get_settings().gemini_model, roadmap.career, [s.model_dump() for s in roadmap.steps], interests],
        sort_keys=True,
    )
    return hashlib.sha256(blob.encode()).hexdigest()


async def explain_roadmap(roadmap: Roadmap, answers: list[Answer] | None = None) -> RoadmapExplanation | None:
    interests = [f'"{r[0]}" -> "{r[1]}"' for a in answers or [] if (r := resolve_answer(a))]
    key = _key(roadmap, interests)
    if key in _cache:
        _cache.move_to_end(key)
        return _cache[key]

    gen = await gemini.generate_json(_prompt(roadmap, interests), _GenExplanation, system=SYSTEM, temperature=0.3)
    if not gen or not gen.summary.strip():
        return None

    ids = {s.id for s in roadmap.steps}
    seen: set[str] = set()
    notes = []
    for n in gen.step_notes:
        if n.id in ids and n.id not in seen and n.note.strip():
            seen.add(n.id)
            notes.append(StepNote(id=n.id, note=n.note.strip()))
    order = {s.id: i for i, s in enumerate(roadmap.steps)}
    notes.sort(key=lambda n: order[n.id])

    result = RoadmapExplanation(
        summary=gen.summary.strip(),
        step_notes=notes,
        first_move=gen.first_move.strip(),
        generated_by=f"Gemini ({get_settings().gemini_model})",
    )
    _cache[key] = result
    if len(_cache) > _CACHE_SIZE:
        _cache.popitem(last=False)
    return result
