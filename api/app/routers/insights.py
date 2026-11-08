import re

from fastapi import APIRouter, HTTPException

from app.schemas import Insights, Prerequisite
from app.services import events, pathways

router = APIRouter(tags=["tiger"])


def _normalize(code: str) -> str:
    """'cts1120' and 'CTS 1120' both become 'CTS 1120'."""
    code = code.strip().upper()
    return re.sub(r"^([A-Z]{3})\s*(\d)", r"\1 \2", code)


@router.get("/courses/{code}/prerequisites", response_model=list[Prerequisite])
async def prerequisites(code: str) -> list[Prerequisite]:
    """Every course you must finish first, nearest first (recursive SQL over the prerequisites table)."""
    chain = await pathways.prerequisite_chain(_normalize(code))
    if chain is None:
        raise HTTPException(404, "Unknown course, or the database isn't connected")
    return chain


@router.get("/insights", response_model=Insights)
async def quiz_insights() -> Insights:
    """Quiz activity from the quiz_events hypertable and its continuous aggregate."""
    result = await events.insights()
    if not result:
        raise HTTPException(503, "Tiger Cloud not connected (set DATABASE_URL)")
    return result
