"""Gemini writes the next calibrating question.

The math picks *what* to ask about (the close contenders and the traits that
separate them); Gemini only phrases a question and tags each option with trait
weights. Those weights go through the same scoring as bank questions, so depth
stays deterministic. Without a key, or if Gemini misbehaves, we fall back to
the most informative unanswered bank question.
"""

import hashlib
import json

from pydantic import BaseModel, create_model

from app.data import FIELDS, TRAIT_DESCRIPTIONS, TRAITS
from app.schemas import Answer, NextQuestion, Option, Question
from app.services import gemini
from app.services.matching import (
    DONE_CONFIDENCE,
    clamp_traits,
    discriminating_traits,
    match,
    most_informative_question,
    ranked,
    resolve_answer,
)

MAX_QUESTIONS = 10  # hard cap so the dive always reaches the floor
FOCUS_FIELDS = 3
MIN_OPTIONS, MAX_OPTIONS = 3, 5

# Gemini's response schema can't express dict[str, float], so each trait is a named field.
_GenTraits = create_model("TraitWeights", **{t: (float, 0.0) for t in TRAITS})  # type: ignore[call-overload]


class _GenOption(BaseModel):
    label: str
    weights: _GenTraits  # type: ignore[valid-type]


class _GenQuestion(BaseModel):
    text: str
    options: list[_GenOption]


SYSTEM = f"""You write questions for Miami Dade College's career-discovery quiz.
Students are 16-25, many are first-generation college students, and English may be their second language.

Rules:
- One short, concrete, everyday-life question (max 15 words). Scenarios and preferences, not job titles.
- {MIN_OPTIONS}-{MAX_OPTIONS} answer options, each max 10 words, all equally appealing (no "right" answer).
- Never mention a career, major or field of study by name in the question or the options.
- Do not repeat the theme of a question already asked.
- For each option, rate 0.0-1.0 how strongly choosing it signals each trait.
  Most weights should be 0. Give each option 1-2 strong traits, and make the options
  differ on the focus traits so the answer actually separates the contenders.

Traits:
{chr(10).join(f"- {t}: {d}" for t, d in TRAIT_DESCRIPTIONS.items())}"""


def _prompt(answers: list[Answer], contenders: list[tuple[str, float]], focus_traits: list[str]) -> str:
    history = [f'- "{r[0]}" -> "{r[1]}"' for a in answers if (r := resolve_answer(a))]
    fields = [
        {"field": FIELDS[s]["name"], "probability": round(p, 2), "trait_profile": FIELDS[s]["profile"]}
        for s, p in contenders
    ]
    return (
        f"Close contenders right now (hidden from the student):\n{json.dumps(fields, indent=1)}\n\n"
        f"Focus traits (where these contenders differ most): {', '.join(focus_traits)}\n\n"
        "Questions already asked and the student's answers:\n"
        + ("\n".join(history) if history else "- none yet")
        + "\n\nWrite the next question."
    )


def _to_question(gen: _GenQuestion) -> Question | None:
    options = []
    for o in gen.options[:MAX_OPTIONS]:
        traits = {t: w for t, w in clamp_traits(o.weights.model_dump()).items() if w > 0}
        label = o.label.strip()
        if label and traits:  # an option that signals nothing can't move the shark
            options.append(Option(label=label, value=len(options), traits=traits))
    text = gen.text.strip()
    if not text or len(options) < MIN_OPTIONS:
        return None
    qid = "gen-" + hashlib.sha1(text.encode()).hexdigest()[:10]
    return Question(id=qid, text=text, options=options, source="gemini")


async def next_question(answers: list[Answer], use_gemini: bool = True) -> NextQuestion:
    order = ranked(answers)
    contenders = order[:FOCUS_FIELDS]
    focus = [match(s, p) for s, p in contenders]
    focus_traits = discriminating_traits([s for s, _ in contenders])

    if order[0][1] >= DONE_CONFIDENCE or len(answers) >= MAX_QUESTIONS:
        return NextQuestion(done=True, question=None, source="none", focus=focus, focus_traits=focus_traits)

    if use_gemini:
        gen = await gemini.generate_json(
            _prompt(answers, contenders, focus_traits), _GenQuestion, system=SYSTEM, temperature=0.8
        )
        asked = {a.question_id for a in answers}
        if gen and (q := _to_question(gen)) and q.id not in asked:
            return NextQuestion(done=False, question=q, source="gemini", focus=focus, focus_traits=focus_traits)

    q = most_informative_question(answers)
    return NextQuestion(
        done=q is None, question=q, source="bank" if q else "none", focus=focus, focus_traits=focus_traits
    )
