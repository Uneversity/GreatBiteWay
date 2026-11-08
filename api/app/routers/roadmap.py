from fastapi import APIRouter, HTTPException

from app.data import MAJORS, fallback_roadmap
from app.schemas import ElaborateRequest, ExplainRequest, Roadmap, RoadmapExplanation, StepElaboration
from app.services import elaborate, explain, pathways

router = APIRouter(tags=["roadmap"])


async def roadmap_for(slug: str) -> Roadmap | None:
    """The full roadmap for a major, or None if the major is unknown."""
    major = next((m for m in MAJORS if m["slug"] == slug), None)
    if not major:
        return None

    # 1. Grounded tree from Tiger Cloud rows (MDC course guides + BLS), when seeded.
    # 2. Otherwise the static placeholder.
    roadmap = await pathways.build_roadmap(slug)
    if not roadmap:
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


@router.post("/roadmap/elaborate", response_model=StepElaboration)
async def elaborate_step(body: ElaborateRequest) -> StepElaboration:
    """A closer look at one step: what it is, quick facts, what to expect, how to prepare."""
    if body.step_id not in {s.id for s in body.roadmap.steps}:
        raise HTTPException(404, "That step isn't in this roadmap")
    result = await elaborate.elaborate_step(body.roadmap, body.step_id, body.major_slug)
    if not result:
        raise HTTPException(503, "Gemini unavailable (is GEMINI_API_KEY set?)")
    return result
