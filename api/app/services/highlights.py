"""Card highlights for the browse-majors page: the main career a major leads to, and
what the MDC part costs in time and money.

Careers come from the same BLS rows the roadmaps use (Tiger Cloud when connected,
otherwise db/seed/pathways.json). Credits and tuition come from app/mdc_info.py, so
the numbers match the roadmap side panel exactly.
"""

import json
from functools import lru_cache
from pathlib import Path

from app import mdc_info
from app.schemas import CareerHighlight, StudyHighlight
from app.services import db

PATHWAYS = Path(__file__).resolve().parents[2] / "db" / "seed" / "pathways.json"
# Must match scripts/seed.py, which stamps these on every BLS row it writes.
BLS_PAY_YEAR, BLS_OUTLOOK_PERIOD = 2025, "2025-35"


@lru_cache
def _seed_careers() -> dict[str, CareerHighlight]:
    data = json.loads(PATHWAYS.read_text(encoding="utf-8"))
    rows = {c[0]: c for c in data["careers"]}  # soc, title, median_pay, outlook, entry_education, source_url
    out = {}
    for slug, socs in data["major_careers"].items():
        if socs and (c := rows.get(socs[0])):
            out[slug] = CareerHighlight(title=c[1], median_pay=c[2], pay_year=BLS_PAY_YEAR, outlook=c[3],
                                        outlook_period=BLS_OUTLOOK_PERIOD, source_url=c[5])
    return out


async def careers() -> dict[str, CareerHighlight]:
    """The first-listed career for every major, from the database when it's connected."""
    if not db.pool:
        return _seed_careers()
    rows = await db.pool.fetch(
        """
        SELECT DISTINCT ON (mc.major_slug) mc.major_slug, c.title, c.median_pay, c.pay_year,
               c.outlook, c.outlook_period, c.source_url
        FROM major_careers mc JOIN careers c ON c.soc_code = mc.soc_code
        ORDER BY mc.major_slug, mc.position
        """
    )
    if not rows:
        return _seed_careers()
    return {r["major_slug"]: CareerHighlight(title=r["title"], median_pay=r["median_pay"], pay_year=r["pay_year"],
                                             outlook=r["outlook"], outlook_period=r["outlook_period"],
                                             source_url=r["source_url"]) for r in rows}


def study(slug: str, mdc_program: str) -> StudyHighlight | None:
    """Degree path, credits, typical years and estimated in-state cost for the MDC part.

    A bachelor's counts only when the major's own program line names one at MDC (e.g.
    "A.S. Nursing, then B.S. in Nursing"); otherwise it's the associate degree alone.
    """
    info = mdc_info.MAJORS.get(slug)
    if not info:
        return None
    a, b = info.associate, info.bachelors
    has_bachelors = b is not None and any(t in mdc_program for t in ("B.S.", "B.A.S.", "BSN"))
    lower, upper = mdc_info.LOWER_DIVISION["resident"], mdc_info.UPPER_DIVISION["resident"]

    if has_bachelors:
        names_associate = a is not None and a.award in mdc_program
        path = f"{a.award} then {b.award}" if names_associate else b.award
        lower_credits = a.credits if names_associate else b.credits - b.upper_credits
        return StudyHighlight(path=path, credits=max(b.credits, lower_credits + b.upper_credits), years=4,
                              est_cost=round(lower_credits * lower + b.upper_credits * upper),
                              source_url=b.source_url, cost_source_url=mdc_info.TUITION_URL)
    if a:
        return StudyHighlight(path=a.award, credits=a.credits, years=2, est_cost=round(a.credits * lower),
                              source_url=a.source_url, cost_source_url=mdc_info.TUITION_URL)
    return None
