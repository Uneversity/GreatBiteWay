from fastapi import APIRouter

from app.data import MAJORS
from app.schemas import Major
from app.services import db, highlights

router = APIRouter(prefix="/majors", tags=["majors"])


@router.get("", response_model=list[Major])
async def list_majors() -> list[Major]:
    if db.pool:
        rows = [dict(r) for r in await db.pool.fetch(
            "SELECT slug, name, field, mdc_program, summary, mdc_url FROM majors ORDER BY sort, name")]
    else:
        rows = [dict(m) for m in MAJORS]
    careers = await highlights.careers()
    return [Major(**r, career=careers.get(r["slug"]), study=highlights.study(r["slug"], r["mdc_program"]))
            for r in rows]
