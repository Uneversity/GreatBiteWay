"""The logged-in student's account: saved roadmaps and quiz results.

Every route needs a valid Auth0 access token (see app/auth.py) and only ever
touches rows whose user_id is that token's `sub`. The server rebuilds roadmaps
and re-scores answers itself instead of storing whatever the client sends.
"""

from fastapi import APIRouter, Depends, HTTPException, Response

from app.auth import require_user
from app.data import MAJORS
from app.routers.roadmap import roadmap_for
from app.schemas import Me, QuizRequest, QuizResult, SavedRoadmap, SavedRoadmapSummary, SaveRoadmapRequest
from app.services import db
from app.services.matching import quiz_step

router = APIRouter(prefix="/me", tags=["me"])

_SUMMARY = "SELECT s.id, s.major_slug, m.name AS major_name, s.created_at, s.updated_at"
_FROM = "FROM saved_roadmaps s JOIN majors m ON m.slug = s.major_slug"


def _pool():
    if not db.pool:
        raise HTTPException(503, "Tiger Cloud not connected (set DATABASE_URL)")
    return db.pool


@router.get("", response_model=Me)
async def me(user: dict = Depends(require_user)) -> Me:
    row = await _pool().fetchrow(
        "SELECT (SELECT count(*) FROM saved_roadmaps WHERE user_id = $1) AS r, "
        "(SELECT count(*) FROM quiz_results WHERE user_id = $1) AS q",
        user["sub"],
    )
    return Me(user_id=user["sub"], saved_roadmaps=row["r"], quiz_results=row["q"])


@router.get("/roadmaps", response_model=list[SavedRoadmapSummary])
async def list_roadmaps(user: dict = Depends(require_user)) -> list[SavedRoadmapSummary]:
    rows = await _pool().fetch(f"{_SUMMARY} {_FROM} WHERE s.user_id = $1 ORDER BY s.updated_at DESC", user["sub"])
    return [SavedRoadmapSummary(**dict(r)) for r in rows]


@router.post("/roadmaps", response_model=SavedRoadmap, status_code=201)
async def save_roadmap(body: SaveRoadmapRequest, user: dict = Depends(require_user)) -> SavedRoadmap:
    """Save (or refresh) this student's copy of a major's roadmap."""
    pool = _pool()
    if not any(m["slug"] == body.major_slug for m in MAJORS):
        raise HTTPException(404, "Unknown major")
    roadmap = await roadmap_for(body.major_slug)
    row = await pool.fetchrow(
        f"""
        WITH s AS (
            INSERT INTO saved_roadmaps (user_id, major_slug, roadmap) VALUES ($1, $2, $3)
            ON CONFLICT (user_id, major_slug) DO UPDATE SET roadmap = EXCLUDED.roadmap, updated_at = now()
            RETURNING *
        )
        {_SUMMARY}, s.roadmap FROM s JOIN majors m ON m.slug = s.major_slug
        """,
        user["sub"], body.major_slug, roadmap.model_dump(mode="json"),
    )
    return SavedRoadmap(**dict(row))


@router.get("/roadmaps/{roadmap_id}", response_model=SavedRoadmap)
async def get_saved_roadmap(roadmap_id: int, user: dict = Depends(require_user)) -> SavedRoadmap:
    row = await _pool().fetchrow(f"{_SUMMARY}, s.roadmap {_FROM} WHERE s.id = $1 AND s.user_id = $2",
                                 roadmap_id, user["sub"])
    if not row:
        raise HTTPException(404, "No saved roadmap with that id")
    return SavedRoadmap(**dict(row))


@router.delete("/roadmaps/{roadmap_id}", status_code=204)
async def delete_saved_roadmap(roadmap_id: int, user: dict = Depends(require_user)) -> Response:
    status = await _pool().execute("DELETE FROM saved_roadmaps WHERE id = $1 AND user_id = $2",
                                   roadmap_id, user["sub"])
    if status == "DELETE 0":
        raise HTTPException(404, "No saved roadmap with that id")
    return Response(status_code=204)


@router.post("/quiz-results", response_model=QuizResult, status_code=201)
async def save_quiz_result(body: QuizRequest, user: dict = Depends(require_user)) -> QuizResult:
    """Store the student's answers with server-computed matches, so they can resume or revisit a dive."""
    if not body.answers:
        raise HTTPException(422, "No answers to save")
    pool = _pool()
    step = quiz_step(body.answers)
    row = await pool.fetchrow(
        "INSERT INTO quiz_results (user_id, answers, top_matches, depth, done) VALUES ($1, $2, $3, $4, $5) "
        "RETURNING id, answers, top_matches, depth, done, created_at",
        user["sub"],
        [a.model_dump(mode="json", exclude_none=True) for a in body.answers],
        [m.model_dump() for m in step.top_matches],
        step.depth,
        step.done,
    )
    return QuizResult(**dict(row))


@router.get("/quiz-results", response_model=list[QuizResult])
async def list_quiz_results(limit: int = 10, user: dict = Depends(require_user)) -> list[QuizResult]:
    rows = await _pool().fetch(
        "SELECT id, answers, top_matches, depth, done, created_at FROM quiz_results "
        "WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
        user["sub"], max(1, min(limit, 50)),
    )
    return [QuizResult(**dict(r)) for r in rows]
