"""Quiz scoring and shark depth.

Depth is computed deterministically from how concentrated the match
distribution is (1 - normalized entropy), NOT decided by an LLM, so the
shark only moves in a predictable, explainable way. Gemini-written questions
feed in through the same trait weights, so they move the shark by the same rules.
"""

import math

from app.data import FIELDS, QUESTIONS, TRAITS
from app.schemas import Answer, FieldMatch, Option, Question, QuizStep

# Scoring = softmax over cosine similarity between the student's trait vector and
# each field's profile. Tuned by simulating an "ideal" student for every field
# (picks the closest option each time): all 15 rank their own field first.
TEMPERATURE = 0.02  # lower = sharper distribution = faster descent
PRIOR = 1.0  # pseudo-count added to every trait so one answer can't decide everything
DONE_CONFIDENCE = 0.6
MIN_ANSWERS = 5  # never call it before this many answers, however confident



def clamp_traits(traits: dict[str, float]) -> dict[str, float]:
    """Keep only known traits, clipped to 0..1, so client-echoed weights can't skew scoring."""
    return {t: min(1.0, max(0.0, float(w))) for t, w in traits.items() if t in TRAITS}


def resolve_answer(a: Answer) -> tuple[str, str, dict[str, float]] | None:
    """(question text, chosen label, trait weights) for a bank or Gemini-written answer."""
    if q := next((q for q in QUESTIONS if q["id"] == a.question_id), None):
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


def _cosine(a: dict[str, float], b: dict[str, float]) -> float:
    dot = sum(a[t] * b[t] for t in TRAITS)
    na = math.sqrt(sum(a[t] ** 2 for t in TRAITS))
    nb = math.sqrt(sum(b[t] ** 2 for t in TRAITS))
    return dot / (na * nb) if na and nb else 0.0


def _probabilities(profile: dict[str, float]) -> dict[str, float]:
    if sum(profile.values()) <= 0:
        return {k: 1 / len(FIELDS) for k in FIELDS}
    smoothed = {t: profile[t] + PRIOR for t in TRAITS}
    raw = {slug: _cosine(smoothed, f["profile"]) for slug, f in FIELDS.items()}
    exps = {k: math.exp(v / TEMPERATURE) for k, v in raw.items()}
    z = sum(exps.values())
    return {k: v / z for k, v in exps.items()}


def probabilities(answers: list[Answer]) -> dict[str, float]:
    return _probabilities(_student_profile(answers))


def _entropy(probs: dict[str, float]) -> float:
    return -sum(p * math.log(p) for p in probs.values() if p > 0)


def _depth(probs: dict[str, float]) -> float:
    return max(0.0, 1 - _entropy(probs) / math.log(len(probs)))


def is_decided(order: list[tuple[str, float]], n_answers: int) -> bool:
    return n_answers >= MIN_ANSWERS and order[0][1] >= DONE_CONFIDENCE


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

    progress = len(answered) / len(QUESTIONS)
    done = is_decided(order, len(answers)) or not remaining
    # Blend entropy-based depth with progress so the shark never stalls, cap it by
    # progress so one lucky answer can't plunge it, and snap to the floor when decided.
    depth = 1.0 if done else min(0.95, 0.2 + 0.8 * progress, 0.6 * _depth(probs) + 0.4 * progress)

    next_q = None if done else _bank_question(remaining[0])

    # "Still in range": a rank-based funnel that narrows evenly from every field to
    # one over the bank questions, so the chips shrink predictably while scores stay honest.
    keep = max(1, round(len(FIELDS) - (len(FIELDS) - 1) * min(1.0, progress)))
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
