"""Thin Gemini API client.

Feature logic lives in questions.py, embeddings.py and explain.py; this module
only talks to the API. Every function returns None when GEMINI_API_KEY is
unset or the call fails, so callers can fall back to deterministic behaviour.
"""

import logging
import math
from functools import lru_cache
from typing import Literal, TypeVar

from google import genai
from google.genai import types
from pydantic import BaseModel, ValidationError

from app.config import get_settings

log = logging.getLogger(__name__)

EMBED_DIM = 768  # must match vector(768) in db/schema.sql (pgvector indexes cap at 2000 dims)
TIMEOUT_MS = 20_000
# Retry rate limits and "high demand" 503s a couple of times before giving up on a model.
RETRY = types.HttpRetryOptions(attempts=3, initial_delay=1.0, max_delay=4.0, http_status_codes=[429, 500, 503])

TaskType = Literal["RETRIEVAL_QUERY", "RETRIEVAL_DOCUMENT", "SEMANTIC_SIMILARITY"]
T = TypeVar("T", bound=BaseModel)


@lru_cache
def _client() -> genai.Client | None:
    key = get_settings().gemini_api_key
    if not key:
        return None
    return genai.Client(api_key=key, http_options=types.HttpOptions(timeout=TIMEOUT_MS, retry_options=RETRY))


def available() -> bool:
    return _client() is not None


async def generate_json(
    prompt: str,
    schema: type[T],
    *,
    system: str,
    temperature: float = 0.4,
    fast: bool = False,
) -> T | None:
    """Structured output: Gemini is constrained to `schema` and the reply is validated.
    Tries the main model (with retries), then the fallback model.
    `fast` turns thinking down to minimal, for calls a student is waiting on."""
    client = _client()
    if not client:
        return None
    s = get_settings()
    for model in dict.fromkeys(m for m in (s.gemini_model, s.gemini_fallback_model) if m):
        try:
            resp = await client.aio.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    temperature=temperature,
                    response_mime_type="application/json",
                    response_schema=schema,
                    thinking_config=types.ThinkingConfig(thinking_level="minimal") if fast else None,
                ),
            )
            if isinstance(resp.parsed, schema):
                return resp.parsed
            return schema.model_validate_json(resp.text or "")
        except ValidationError as e:
            log.warning("Gemini (%s) returned JSON that failed %s validation: %s", model, schema.__name__, e)
        except Exception as e:  # network, quota, overload, safety block: try the next model, then fall back
            log.warning("Gemini (%s) generate_content failed: %s", model, e)
    return None


def _normalize(v: list[float]) -> list[float]:
    # gemini-embedding-001 only L2-normalizes at its full 3072 dims; truncated
    # vectors must be normalized by hand or cosine scores drift.
    norm = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / norm for x in v]


async def embed(texts: list[str], task_type: TaskType) -> list[list[float]] | None:
    """One normalized EMBED_DIM vector per input text, in order."""
    client = _client()
    if not client or not texts:
        return None
    try:
        resp = await client.aio.models.embed_content(
            model=get_settings().gemini_embed_model,
            contents=texts,
            config=types.EmbedContentConfig(task_type=task_type, output_dimensionality=EMBED_DIM),
        )
        vectors = [_normalize(list(e.values or [])) for e in resp.embeddings or []]
        if len(vectors) != len(texts):
            log.warning("Gemini returned %d embeddings for %d texts", len(vectors), len(texts))
            return None
        return vectors
    except Exception as e:
        log.warning("Gemini embed_content failed: %s", e)
    return None


def cosine(a: list[float], b: list[float]) -> float:
    """Inputs are already normalized, so cosine similarity is the dot product."""
    return sum(x * y for x, y in zip(a, b))
