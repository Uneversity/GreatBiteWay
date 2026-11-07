"""Quiz scoring and shark depth.

Depth is computed deterministically from how concentrated the match
distribution is (1 - normalized entropy), NOT decided by an LLM, so the
shark only moves in a predictable, explainable way. Gemini-written questions
feed in through the same trait weights, so they move the shark by the same rules.
"""

import math

from app.data import FIELDS, QUESTIONS, TRAITS
from app.schemas import Answer, FieldMatch, Option, Question, QuizStep

TEMPERATURE = 0.35  # lower = sharper distribution = faster descent
DONE_CONFIDENCE = 0.6

_BANK = {q["id"]: q for q in QUESTIONS}


def clamp_traits(traits: dict[str, float]) -> dict[str, float]:
    """Keep only known traits, clipped to 0..1, so client-echoed weights can't skew scoring."""
    return {t: min(1.0, max(0.0, float(w))) for t, w in traits.items() if t in TRAITS}


def resolve_answer(a: Answer) -> tuple[str, str, dict[str, float]] | None:
    """(question text, chosen label, trait weights) for a bank or Gemini-written answer."""
    if q := _BANK.get(a.question_id):
        if 0 <= a.value < len(q["options"]):
            o = q["options"][a.value]
            return q["text"], o["label"], o["traits"]
        return None
    q = a.question
    if q and q.id == a.question_id and 0 <= a.value < len(q.options):
        o = q.options[a.value]
        return q.text, o.label, clamp_traits(o.traits or {})
    return None


def _student_profile(answers: list[Answer]) -> dict[str, float]:
    profile = {t: 0.0 for t in TRAITS}
    for a in answers:
        if resolved := resolve_answer(a):
            for trait, w in resolved[2].items():
                profile[trait] += w
    return profile


def _probabilities(profile: dict[str, float]) -> dict[str, float]:
    total = sum(profile.values())
    if total <= 0:
        return {k: 1 / len(FIELDS) for k in FIELDS}
    raw = {
        slug: sum(profile[t] / total * f["profile"][t] for t in TRAITS)
        for slug, f in FIELDS.items()
    }
    exps = {k: math.exp(v / TEMPERATURE) for k, v in raw.items()}
    z = sum(exps.values())
    return {k: v / z for k, v in exps.items()}


def probabilities(answers: list[Answer]) -> dict[str, float]:
    return _probabilities(_student_profile(answers))


def _entropy(probs: dict[str, float]) -> float:
    return -sum(p * math.log(p) for p in probs.values() if p > 0)


def _depth(probs: dict[str, float]) -> float:
    return max(0.0, 1 - _entropy(probs) / math.log(len(probs)))


def match(slug: str, score: float) -> FieldMatch:
    return FieldMatch(slug=slug, name=FIELDS[slug]["name"], score=round(score, 3))


def ranked(answers: list[Answer]) -> list[tuple[str, float]]:
    return sorted(probabilities(answers).items(), key=lambda kv: kv[1], reverse=True)


def discriminating_traits(slugs: list[str], k: int = 2) -> list[str]:
    """Traits whose field profiles differ most across `slugs`: what a good question should probe."""
    if len(slugs) < 2:
        return []

    def spread(t: str) -> float:
        vals = [FIELDS[s]["profile"][t] for s in slugs]
        mean = sum(vals) / len(vals)
        return sum((v - mean) ** 2 for v in vals)

    return sorted(TRAITS, key=spread, reverse=True)[:k]


def _bank_question(q: dict) -> Question:
    return Question(
        id=q["id"],
        text=q["text"],
        options=[Option(label=o["label"], value=i) for i, o in enumerate(q["options"])],
    )


def most_informative_question(answers: list[Answer]) -> Question | None:
    """Unanswered bank question with the lowest expected entropy afterwards
    (options treated as equally likely). Fallback when Gemini is unavailable."""
    answered = {a.question_id for a in answers}
    base = _student_profile(answers)
    best, best_h = None, math.inf
    for q in QUESTIONS:
        if q["id"] in answered:
            continue
        hs = []
        for o in q["options"]:
            p = dict(base)
            for t, w in o["traits"].items():
                p[t] += w
            hs.append(_entropy(_probabilities(p)))
        h = sum(hs) / len(hs)
        if h < best_h:
            best, best_h = q, h
    return _bank_question(best) if best else None


def quiz_step(answers: list[Answer]) -> QuizStep:
    order = ranked(answers)
    probs = dict(order)
    answered = {a.question_id for a in answers}
    remaining = [q for q in QUESTIONS if q["id"] not in answered]

    done = (order[0][1] >= DONE_CONFIDENCE) or not remaining
    # Blend entropy-based depth with progress so the shark never stalls,
    # and snap to the floor when a field is decided.
    depth = 1.0 if done else min(0.95, 0.6 * _depth(probs) + 0.4 * len(answered) / len(QUESTIONS))

    next_q = None if done else _bank_question(remaining[0])

    # "Still in range": a rank-based funnel. Each answer retires the weakest field,
    # so the chips narrow predictably (5 → 4 → 3 → 2 → 1) while the scores stay honest.
    keep = max(1, len(FIELDS) - len(answers))
    in_range = [match(s, p) for s, p in order[:keep]]

    return QuizStep(
        depth=round(depth, 3),
        done=done,
        next_question=next_q,
        top_matches=[match(s, p) for s, p in order[:3]],
        in_range=in_range,
    )


def all_questions() -> list[Question]:
    return [_bank_question(q) for q in QUESTIONS]
