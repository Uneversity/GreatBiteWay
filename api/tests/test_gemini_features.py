"""Gemini features with the API faked out, plus the no-key fallbacks.

Run from api/:  python -m pytest
"""

import math

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import embeddings, explain, gemini


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def reset_caches():
    embeddings._field_vectors = None
    explain._cache.clear()


@pytest.fixture
def no_gemini(monkeypatch):
    async def none(*_a, **_k):
        return None

    monkeypatch.setattr(gemini, "generate_json", none)
    monkeypatch.setattr(gemini, "embed", none)


def fake_generate(payload: dict):
    async def generate_json(prompt, schema, **_k):
        fake_generate.last_prompt = prompt
        return schema.model_validate(payload)

    return generate_json


GOOD_QUESTION = {
    "text": "A friend's laptop got hacked. What do you do first?",
    "options": [
        {"label": "Figure out how they got in", "weights": {"analytical": 0.8, "protective": 0.9}},
        {"label": "Calm your friend down", "weights": {"people": 0.9}},
        {"label": "Open it up and check the hardware", "weights": {"hands_on": 0.7, "technical": 0.6}},
        {"label": "Sketch a better warning screen", "weights": {"creative": 0.9, "technical": 9}},
    ],
}


# --- next calibrating question -------------------------------------------------

def test_next_question_falls_back_to_bank(client, no_gemini):
    r = client.post("/quiz/next", json={"answers": [{"question_id": "q_weekend", "value": 0}]}).json()
    assert r["source"] == "bank" and not r["done"]
    assert r["question"]["id"].startswith("q_") and r["question"]["id"] != "q_weekend"
    assert len(r["focus"]) == 3 and len(r["focus_traits"]) == 2


def test_next_question_from_gemini_and_scoring(client, monkeypatch):
    monkeypatch.setattr(gemini, "generate_json", fake_generate(GOOD_QUESTION))
    r = client.post("/quiz/next", json={"answers": [{"question_id": "q_weekend", "value": 3}]}).json()
    q = r["question"]
    assert r["source"] == "gemini" and q["source"] == "gemini" and q["id"].startswith("gen-")
    assert [o["value"] for o in q["options"]] == [0, 1, 2, 3]
    assert q["options"][3]["traits"]["technical"] == 1.0  # out-of-range weight clamped
    assert "Free Saturday" in fake_generate.last_prompt  # history reaches the prompt

    base = [{"question_id": "q_weekend", "value": 3}]
    before = client.post("/quiz/step", json={"answers": base}).json()
    after = client.post("/quiz/step", json={"answers": base + [{"question_id": q["id"], "value": 0, "question": q}]}).json()
    assert after["top_matches"][0]["slug"] == "cybersecurity"
    assert after["top_matches"][0]["score"] > before["top_matches"][0]["score"]


def test_tampered_traits_are_clamped(client):
    q = {"id": "gen-x", "text": "?", "source": "gemini",
         "options": [{"label": "a", "value": 0, "traits": {"people": 50, "bogus": 3}}]}
    r = client.post("/quiz/step", json={"answers": [{"question_id": "gen-x", "value": 0, "question": q}]}).json()
    assert r["top_matches"][0]["slug"] == "it-consulting" and r["top_matches"][0]["score"] < 1


@pytest.mark.parametrize("bad", [
    {"text": "Too few?", "options": GOOD_QUESTION["options"][:2]},
    {"text": "All blank?", "options": [{"label": f"o{i}", "weights": {}} for i in range(4)]},
    {"text": "  ", "options": GOOD_QUESTION["options"]},
])
def test_bad_gemini_output_falls_back(client, monkeypatch, bad):
    monkeypatch.setattr(gemini, "generate_json", fake_generate(bad))
    assert client.post("/quiz/next", json={"answers": []}).json()["source"] == "bank"


CULINARY = [("q_weekend", 2), ("q_workspace", 3), ("q_pressure", 2), ("q_problem", 3), ("q_compliment", 3)]


def test_next_question_not_done_before_min_answers(client, no_gemini):
    answers = [{"question_id": q, "value": v} for q, v in CULINARY[:4]]
    r = client.post("/quiz/next", json={"answers": answers}).json()
    assert not r["done"] and r["question"] is not None


def test_next_question_done_when_confident(client, no_gemini):
    answers = [{"question_id": q, "value": v} for q, v in CULINARY]
    r = client.post("/quiz/next", json={"answers": answers}).json()
    assert r["done"] and r["question"] is None
    assert r["focus"][0]["slug"] == "culinary-arts"


# --- embeddings ----------------------------------------------------------------

TOPICS = ["kitchen", "chef", "cook", "food", "culinary", "secur", "network", "data",
          "design", "build", "machine", "engine", "client", "technolog"]


async def fake_embed(texts, task_type):
    """One dimension per topic stem (plus a bias dim): shared topics, similar vectors."""
    out = []
    for t in texts:
        low = t.lower()
        v = [float(low.count(stem)) for stem in TOPICS] + [0.1]
        n = math.sqrt(sum(x * x for x in v))
        out.append([x / n for x in v])
    return out


def test_semantic_match_in_memory(client, monkeypatch):
    monkeypatch.setattr(gemini, "embed", fake_embed)
    r = client.post("/quiz/semantic", json={
        "answers": [{"question_id": "q_workspace", "value": 3}],
        "free_text": "I love cooking food in a busy kitchen for people",
    }).json()
    assert r["backend"] == "memory" and len(r["matches"]) == 5
    assert r["matches"][0]["slug"] == "culinary-arts"
    assert "busy kitchen" in r["profile_text"]


def test_semantic_requires_input(client):
    assert client.post("/quiz/semantic", json={}).status_code == 422


def test_semantic_without_key_is_503(client, no_gemini):
    assert client.post("/quiz/semantic", json={"free_text": "hi"}).status_code == 503


def test_field_documents_cover_all_fields():
    for slug in embeddings.FIELDS:
        doc = embeddings.field_document(slug)
        assert embeddings.FIELDS[slug]["name"] in doc and "Miami Dade" in doc


# --- roadmap explanation -------------------------------------------------------

EXPLANATION = {
    "summary": "You start at MDC and finish in about four years.",
    "step_notes": [
        {"id": "s3", "note": "Finish your associate degree."},
        {"id": "s1", "note": "Sign up at MDC."},
        {"id": "s99", "note": "Invented step."},
        {"id": "s1", "note": "Duplicate."},
    ],
    "first_move": "Apply online at mdc.edu this week.",
}


def test_explain_endpoint_filters_and_orders_notes(client, monkeypatch):
    monkeypatch.setattr(gemini, "generate_json", fake_generate(EXPLANATION))
    roadmap = client.get("/roadmap/cybersecurity").json()
    assert roadmap["explanation"]["summary"] == roadmap["summary"] == EXPLANATION["summary"]

    r = client.post("/roadmap/explain", json={
        "roadmap": roadmap, "answers": [{"question_id": "q_impact", "value": 3}],
    }).json()
    assert [n["id"] for n in r["step_notes"]] == ["s1", "s3"]
    assert r["first_move"] and r["generated_by"].startswith("Gemini")
    assert "Keeping people and their data safe" in fake_generate.last_prompt


def test_roadmap_without_key_keeps_fallback_summary(client, no_gemini):
    r = client.get("/roadmap/architecture").json()
    assert r["explanation"] is None and "fallback" in r["summary"].lower()
    assert client.post("/roadmap/explain", json={"roadmap": r}).status_code == 503
