"""Gemini API wrapper. Every function returns None when no key is set."""

from functools import lru_cache

from google import genai
from google.genai import types

from app.config import get_settings

EMBED_DIM = 768  # must match vector(768) in db/schema.sql (pgvector indexes cap at 2000 dims)


@lru_cache
def _client() -> genai.Client | None:
    key = get_settings().gemini_api_key
    return genai.Client(api_key=key) if key else None


async def generate(prompt: str) -> str | None:
    client = _client()
    if not client:
        return None
    resp = await client.aio.models.generate_content(model=get_settings().gemini_model, contents=prompt)
    return resp.text


async def embed(text: str) -> list[float] | None:
    """Embedding for pgvector similarity search (store in majors.embedding)."""
    client = _client()
    if not client:
        return None
    resp = await client.aio.models.embed_content(
        model=get_settings().gemini_embed_model,
        contents=text,
        config=types.EmbedContentConfig(output_dimensionality=EMBED_DIM),
    )
    return list(resp.embeddings[0].values)


async def explain_roadmap(career: str, steps_text: str) -> str | None:
    return await generate(
        "You are an academic advisor at Miami Dade College. In 3 friendly sentences, "
        f"explain this pathway to becoming a {career} to a first-year student:\n{steps_text}"
    )
