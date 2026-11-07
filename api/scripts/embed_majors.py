"""Seed majors into Tiger Cloud and fill majors.embedding with Gemini vectors.

Run from api/ after applying db/schema.sql:
    python -m scripts.embed_majors

Idempotent: re-running upserts the rows and refreshes every embedding.
"""

import asyncio
import sys

from app.data import FIELDS, MAJORS
from app.services import db, gemini
from app.services.embeddings import field_document


async def main() -> int:
    await db.connect()
    if not db.pool:
        print("DATABASE_URL is not set")
        return 1
    try:
        slugs = [m["slug"] for m in MAJORS if m["slug"] in FIELDS]
        vecs = await gemini.embed([field_document(s) for s in slugs], "RETRIEVAL_DOCUMENT")
        if not vecs:
            print("Gemini embedding failed (is GEMINI_API_KEY set?)")
            return 1
        by_slug = dict(zip(slugs, vecs))
        async with db.pool.acquire() as conn, conn.transaction():
            for m in MAJORS:
                await conn.execute(
                    """
                    INSERT INTO majors (slug, name, field, mdc_program, summary, embedding)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (slug) DO UPDATE SET
                        name = EXCLUDED.name, field = EXCLUDED.field, mdc_program = EXCLUDED.mdc_program,
                        summary = EXCLUDED.summary, embedding = EXCLUDED.embedding
                    """,
                    m["slug"], m["name"], m["field"], m["mdc_program"], m["summary"], by_slug.get(m["slug"]),
                )
        print(f"Embedded {len(by_slug)} majors ({gemini.EMBED_DIM} dims)")
        return 0
    finally:
        await db.disconnect()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
