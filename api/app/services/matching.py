"""Quiz scoring and shark depth.

Depth is computed deterministically from how concentrated the match
distribution is (1 - normalized entropy), NOT decided by an LLM, so the
shark only moves in a predictable, explainable way.
Later: replace the dot-product with pgvector similarity on Gemini embeddings.
"""

import math

from app.data import FIELDS, QUESTIONS, TRAITS
from app.schemas import Answer, FieldMatch, Option, Question, QuizStep

TEMPERATURE = 0.35  # lower = sharper distribution = faster descent
DONE_CONFIDENCE = 0.6


def _student_profile(answers: list[Answer]) -> dict[str, float]:
    by_id = {q["id"]: q for q in QUESTIONS}
    profile = {t: 0.0 for t in TRAITS}
    for a in answers:
        q = by_id.get(a.question_id)
        if not q or not 0 <= a.value < len(q["options"]):
            continue
        for trait, w in q["options"][a.value]["traits"].items():
            profile[trait] += w
    return profile


def _probabilities(profile: dict[str, float]) -> dict[str, float]:
    total = sum(profile.values()) or 1.0
    raw = {
        slug: sum(profile[t] / total * f["profile"][t] for t in TRAITS)
        for slug, f in FIELDS.items()
    }
    exps = {k: math.exp(v / TEMPERATURE) for k, v in raw.items()}
    z = sum(exps.values())
    return {k: v / z for k, v in exps.items()}


def _depth(probs: dict[str, float]) -> float:
    entropy = -sum(p * math.log(p) for p in probs.values() if p > 0)
    return max(0.0, 1 - entropy / math.log(len(probs)))


def quiz_step(answers: list[Answer]) -> QuizStep:
    probs = _probabilities(_student_profile(answers)) if answers else {k: 1 / len(FIELDS) for k in FIELDS}
    ranked = sorted(probs.items(), key=lambda kv: kv[1], reverse=True)
    answered = {a.question_id for a in answers}
    remaining = [q for q in QUESTIONS if q["id"] not in answered]

    done = (ranked[0][1] >= DONE_CONFIDENCE) or not remaining
    # Blend entropy-based depth with progress so the shark never stalls,
    # and snap to the floor when a field is decided.
    depth = 1.0 if done else min(0.95, 0.6 * _depth(probs) + 0.4 * len(answered) / len(QUESTIONS))

    next_q = None
    if not done:
        q = remaining[0]  # TODO: pick the most informative question / let Gemini phrase it
        next_q = Question(
            id=q["id"],
            text=q["text"],
            options=[Option(label=o["label"], value=i) for i, o in enumerate(q["options"])],
        )

    def match(s: str, p: float) -> FieldMatch:
        return FieldMatch(slug=s, name=FIELDS[s]["name"], score=round(p, 3))

    # "Still in range": a rank-based funnel. Each answer retires the weakest field,
    # so the chips narrow predictably (5 → 4 → 3 → 2 → 1) while the scores stay honest.
    keep = max(1, len(FIELDS) - len(answers))
    in_range = [match(s, p) for s, p in ranked[:keep]]

    return QuizStep(
        depth=round(depth, 3),
        done=done,
        next_question=next_q,
        top_matches=[match(s, p) for s, p in ranked[:3]],
        in_range=in_range,
    )


def all_questions() -> list[Question]:
    return [
        Question(id=q["id"], text=q["text"], options=[Option(label=o["label"], value=i) for i, o in enumerate(q["options"])])
        for q in QUESTIONS
    ]
