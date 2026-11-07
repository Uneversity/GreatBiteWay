"""Postgres on Tiger Cloud via asyncpg. If DATABASE_URL is empty, `pool` stays None
and routes fall back to app/data.py."""

import asyncpg
from pgvector.asyncpg import register_vector

from app.config import get_settings

pool: asyncpg.Pool | None = None


async def connect() -> None:
    global pool
    url = get_settings().database_url
    if not url:
        return
    pool = await asyncpg.create_pool(url, min_size=1, max_size=5, init=register_vector)


async def disconnect() -> None:
    if pool:
        await pool.close()
