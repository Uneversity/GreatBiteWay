"""Guards for the major catalog and the bank questions in app/data.py."""

import math

import pytest

from app.data import FIELDS, MAJORS, QUESTIONS, TRAIT_DESCRIPTIONS, TRAITS
from app.schemas import Answer
from app.services.matching import quiz_step


def _vec(d: dict) -> list[float]:
    return [d.get(t, 0.0) for t in TRAITS]


def _cos(a: list[float], b: list[float]) -> float:
    na, nb = math.sqrt(sum(x * x for x in a)), math.sqrt(sum(x * x for x in b))
    return sum(x * y for x, y in zip(a, b)) / (na * nb) if na and nb else 0.0


def test_catalog_is_consistent():
    assert len(FIELDS) <= 15
    assert {m["slug"] for m in MAJORS} == set(FIELDS)
    assert set(TRAIT_DESCRIPTIONS) == set(TRAITS)
    for f in FIELDS.values():
        assert set(f["profile"]) == set(TRAITS) and all(0 <= w <= 1 for w in f["profile"].values())
    for q in QUESTIONS:
        assert 2 <= len(q["options"]) <= 6  # the checkpoint UI letters options A-F
        for o in q["options"]:
            assert o["traits"] and set(o["traits"]) <= set(TRAITS)


@pytest.mark.parametrize("slug", list(FIELDS))
def test_ideal_student_lands_on_their_field(slug):
    """A student who always picks the option closest to a field's profile should
    end up with that field on top. Fails if profiles or options drift into overlap."""
    target = _vec(FIELDS[slug]["profile"])
    answers = []
    for q in QUESTIONS:
        best = max(range(len(q["options"])), key=lambda i: _cos(_vec(q["options"][i]["traits"]), target))
        answers.append(Answer(question_id=q["id"], value=best))
    assert quiz_step(answers).top_matches[0].slug == slug


def _pick(qid: str, text: str) -> Answer:
    q = next(q for q in QUESTIONS if q["id"] == qid)
    return Answer(question_id=qid, value=next(i for i, o in enumerate(q["options"]) if text.lower() in o["label"].lower()))


@pytest.mark.parametrize("picks, field", [
    # A typical coder: these all used to drift to Mechanical Engineering.
    ({"q_weekend": "website", "q_team": "write the code", "q_math": "love it", "q_elective": "coding",
      "q_documentary": "startup", "q_workspace": "quiet desk", "q_problem": "test ideas",
      "q_spotlight": "data or systems", "q_compliment": "get it to do that", "q_impact": "building technology",
      "q_pressure": "cyberattack"}, "software-development"),
    ({"q_weekend": "puzzle", "q_team": "write the code", "q_math": "love it", "q_elective": "coding",
      "q_documentary": "skyscrapers", "q_workspace": "quiet desk", "q_problem": "test ideas",
      "q_spotlight": "data or systems", "q_compliment": "fix anything", "q_impact": "building technology",
      "q_pressure": "cyberattack"}, "software-development"),
    # Neighbours that must stay put.
    ({"q_weekend": "gadget", "q_team": "build the actual", "q_math": "love it", "q_elective": "coding",
      "q_documentary": "skyscrapers", "q_workspace": "workshop", "q_problem": "grab some tools",
      "q_spotlight": "behind the scenes", "q_compliment": "fix anything", "q_impact": "building technology",
      "q_pressure": "cyberattack"}, "mechanical-engineering"),
    ({"q_weekend": "puzzle", "q_team": "find the flaws", "q_math": "love it", "q_elective": "coding",
      "q_documentary": "criminal", "q_workspace": "quiet desk", "q_problem": "who or what caused",
      "q_spotlight": "data or systems", "q_compliment": "nothing slips", "q_impact": "keeping people",
      "q_pressure": "cyberattack"}, "cybersecurity"),
])
def test_natural_tech_students_land_on_their_field(picks, field):
    answers = [_pick(q, t) for q, t in picks.items()]
    assert quiz_step(answers).top_matches[0].slug == field


def test_in_range_funnel_narrows_to_one():
    answers, sizes = [], []
    for q in QUESTIONS:
        answers.append(Answer(question_id=q["id"], value=0))
        sizes.append(len(quiz_step(answers).in_range))
    assert len(quiz_step([]).in_range) == len(FIELDS)
    assert sizes == sorted(sizes, reverse=True) and sizes[-1] == 1
