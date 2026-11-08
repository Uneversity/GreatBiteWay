from fastapi import APIRouter

from app.data import MAJORS
from app.schemas import Major
from app.services import db

router = APIRouter(prefix="/majors", tags=["majors"])


@router.get("", response_model=list[Major])
async def list_majors() -> list[Major]:
    if db.pool:
        rows = await db.pool.fetch("SELECT slug, name, field, mdc_program, summary, mdc_url FROM majors ORDER BY sort, name")
        return [Major(**dict(r)) for r in rows]
    return [Major(**m) for m in MAJORS]
