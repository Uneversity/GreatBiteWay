from fastapi import APIRouter, Depends, HTTPException

from app.auth import require_user
from app.data import MAJORS, fallback_roadmap
from app.schemas import Roadmap
from app.services import db, gemini, swarms

router = APIRouter(tags=["roadmap"])


@router.get("/roadmap/{slug}", response_model=Roadmap)
async def get_roadmap(slug: str) -> Roadmap:
    major = next((m for m in MAJORS if m["slug"] == slug), None)
    if not major:
        raise HTTPException(404, "Unknown major")

    # TODO: pull real catalog rows (courses/prereqs) from Postgres for this program.
    catalog_rows = [major]

    result = await swarms.generate_roadmap(major["name"], catalog_rows)
    if result:
        roadmap = Roadmap(career=major["name"], summary=result["summary"], steps=result["steps"],
                          generated_by=f"Swarms (cost: {result.get('cost')})")
    else:
        roadmap = Roadmap(**fallback_roadmap(slug, major["name"], major["mdc_program"]))

    explanation = await gemini.explain_roadmap(
        roadmap.career, "\n".join(f"- {s.title}: {s.detail}" for s in roadmap.steps)
    )
    if explanation:
        roadmap.summary = explanation
    return roadmap


@router.get("/me/roadmaps")
async def my_roadmaps(user: dict = Depends(require_user)) -> list[dict]:
    """Saved roadmaps for the logged-in student."""
    if not db.pool:
        return []
    rows = await db.pool.fetch(
        "SELECT id, major_slug, created_at FROM saved_roadmaps WHERE user_id = $1 ORDER BY created_at DESC",
        user["sub"],
    )
    return [dict(r) for r in rows]
