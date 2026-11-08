from fastapi import APIRouter, Depends, HTTPException

from app.auth import require_user
from app.data import MAJORS, fallback_roadmap
from app.schemas import ExplainRequest, Roadmap, RoadmapExplanation
from app.services import db, explain, pathways, swarms

router = APIRouter(tags=["roadmap"])


@router.get("/roadmap/{slug}", response_model=Roadmap)
async def get_roadmap(slug: str) -> Roadmap:
    major = next((m for m in MAJORS if m["slug"] == slug), None)
    if not major:
        raise HTTPException(404, "Unknown major")

    # 1. Grounded tree from Tiger Cloud rows (MDC course guides + BLS), when seeded.
    # 2. Otherwise the Swarms agents, then 3. the static placeholder.
    roadmap = await pathways.build_roadmap(slug)
    if not roadmap:
        result = await swarms.generate_roadmap(major["name"], [major])
        if result:
            roadmap = Roadmap(career=major["name"], summary=result["summary"], steps=result["steps"],
                              generated_by=f"Swarms (cost: {result.get('cost')})")
        else:
            roadmap = Roadmap(**fallback_roadmap(slug, major["name"], major["mdc_program"]))

    if explanation := await explain.explain_roadmap(roadmap):
        roadmap.summary = explanation.summary
        roadmap.explanation = explanation
    return roadmap


@router.post("/roadmap/explain", response_model=RoadmapExplanation)
async def explain_roadmap(body: ExplainRequest) -> RoadmapExplanation:
    """Plain-English explanation of any roadmap, personalized when quiz answers are included."""
    result = await explain.explain_roadmap(body.roadmap, body.answers)
    if not result:
        raise HTTPException(503, "Gemini unavailable (is GEMINI_API_KEY set?)")
    return result


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
