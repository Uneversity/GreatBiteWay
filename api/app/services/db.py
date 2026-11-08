"""Postgres on Tiger Cloud via asyncpg. If DATABASE_URL is empty, `pool` stays None
and everything falls back to app/data.py."""

import json
import logging

import asyncpg
from pgvector.asyncpg import register_vector

from app.config import get_settings

log = logging.getLogger(__name__)

pool: asyncpg.Pool | None = None


async def _init(conn: asyncpg.Connection) -> None:
    await register_vector(conn)
    # jsonb columns come back as dicts/lists and accept them as parameters.
    await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")


async def connect() -> None:
    global pool
    url = get_settings().database_url
    if not url:
        return
    try:
        pool = await asyncpg.create_pool(url, min_size=1, max_size=5, init=_init, command_timeout=30)
    except ValueError:
        # register_vector raises this when the pgvector extension isn't installed yet
        # (fresh database, before `python -m scripts.seed`). Connect without it.
        log.warning("pgvector not installed yet; run `python -m scripts.seed`")
        pool = await asyncpg.create_pool(url, min_size=1, max_size=5, command_timeout=30)


async def disconnect() -> None:
    global pool
    if pool:
        await pool.close()
        pool = None
