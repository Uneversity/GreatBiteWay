from fastapi import APIRouter, HTTPException

from app.data import MAJORS, fallback_roadmap
from app.schemas import ExplainRequest, Roadmap, RoadmapExplanation
from app.services import explain, pathways, swarms

router = APIRouter(tags=["roadmap"])


async def roadmap_for(slug: str) -> Roadmap | None:
    """The full roadmap for a major, or None if the major is unknown."""
    major = next((m for m in MAJORS if m["slug"] == slug), None)
    if not major:
        return None

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


@router.get("/roadmap/{slug}", response_model=Roadmap)
async def get_roadmap(slug: str) -> Roadmap:
    roadmap = await roadmap_for(slug)
    if not roadmap:
        raise HTTPException(404, "Unknown major")
    return roadmap


@router.post("/roadmap/explain", response_model=RoadmapExplanation)
async def explain_roadmap(body: ExplainRequest) -> RoadmapExplanation:
    """Plain-English explanation of any roadmap, personalized when quiz answers are included."""
    result = await explain.explain_roadmap(body.roadmap, body.answers)
    if not result:
        raise HTTPException(503, "Gemini unavailable (is GEMINI_API_KEY set?)")
    return result
