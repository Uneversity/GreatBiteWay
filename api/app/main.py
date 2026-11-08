from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import insights, majors, me, quiz, roadmap
from app.services import catalog, db, events


@asynccontextmanager
async def lifespan(_: FastAPI):
    await db.connect()
    await catalog.load_from_db()
    yield
    await events.drain()
    await db.disconnect()


app = FastAPI(title="Shark Pathways API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(quiz.router)
app.include_router(majors.router)
app.include_router(roadmap.router)
app.include_router(insights.router)
app.include_router(me.router)


@app.get("/health")
async def health() -> dict:
    s = get_settings()
    return {
        "ok": True,
        "integrations": {
            "tiger_postgres": db.pool is not None,
            "catalog_source": catalog.source,
            "gemini": bool(s.gemini_api_key),
            "auth0": bool(s.auth0_domain and s.auth0_audience),
        },
    }
