"""Builds a roadmap tree from Tiger Cloud rows: MDC semesters, transfer, certifications, careers.

Every step comes from a database row and carries that row's source_url, so
nothing in the tree is invented. Gemini only explains the result afterwards.
"""

from collections import defaultdict

from app.schemas import CourseRef, Prerequisite, Roadmap, RoadmapStep
from app.services import db

_DURATION = {"during": "During your MDC program", "after_program": "After your MDC program",
             "after_degree": "After your bachelor's"}


def _career_detail(c) -> str:
    return (f"Median pay ${c['median_pay']:,} a year ({c['pay_year']}). "
            f"Job outlook {c['outlook_period']}: {c['outlook']}. "
            f"Typical entry-level education: {c['entry_education']}.")


async def build_roadmap(slug: str) -> Roadmap | None:
    """None when the database isn't connected or doesn't know this major."""
    if not db.pool:
        return None
    async with db.pool.acquire() as conn:
        major = await conn.fetchrow("SELECT name, mdc_program, mdc_url FROM majors WHERE slug = $1", slug)
        if not major:
            return None
        rows = await conn.fetch(
            """
            SELECT pc.requirement, pc.term, pc.course_code, pc.note, c.title, c.credits, cert.name AS cert_name
            FROM program_courses pc
            JOIN courses c ON c.code = pc.course_code
            LEFT JOIN certifications cert ON cert.id = c.prepares_for
            WHERE pc.major_slug = $1
            ORDER BY pc.requirement DESC, pc.term, pc.position
            """,
            slug,
        )
        source = await conn.fetchrow("SELECT source_url, effective_term FROM program_sources WHERE major_slug = $1", slug)
        certs = await conn.fetch(
            "SELECT c.id, c.name, c.issuer, c.why, c.source_url, mc.timing FROM major_certifications mc "
            "JOIN certifications c ON c.id = mc.cert_id WHERE mc.major_slug = $1 ORDER BY mc.position",
            slug,
        )
        transfers = await conn.fetch(
            "SELECT institution, program, notes, source_url FROM transfer_options WHERE major_slug = $1 ORDER BY position",
            slug,
        )
        careers = await conn.fetch(
            "SELECT c.* FROM major_careers mc JOIN careers c ON c.soc_code = mc.soc_code "
            "WHERE mc.major_slug = $1 ORDER BY mc.position",
            slug,
        )

    steps: list[RoadmapStep] = [RoadmapStep(
        id="enroll", stage="mdc", title="Enroll at MDC", detail=major["mdc_program"],
        duration="Before semester 1", source_url=major["mdc_url"],
    )]

    terms: dict[int, list[CourseRef]] = defaultdict(list)
    extra: list[CourseRef] = []
    for r in rows:
        ref = CourseRef(code=r["course_code"], title=r["title"], credits=r["credits"], note=r["note"],
                        prepares_for=r["cert_name"])
        (terms[r["term"]] if r["requirement"] == "sequence" else extra).append(ref)

    guide = source["source_url"] if source else major["mdc_url"]
    prev = "enroll"
    for t in sorted(terms):
        courses = terms[t]
        steps.append(RoadmapStep(
            id=f"term-{t}", stage="mdc", title=f"Semester {t}",
            detail=f"{len(courses)} courses, {sum(c.credits for c in courses)} credits",
            duration=f"Semester {t}", depends_on=[prev], courses=courses, source_url=guide,
        ))
        prev = f"term-{t}"
    if not terms:
        steps.append(RoadmapStep(
            id="coursework", stage="mdc", title="Complete your MDC program",
            detail="Follow your program's course sequence guide with an MDC advisor.",
            duration="About 2 years full-time", depends_on=["enroll"], source_url=major["mdc_url"],
        ))
        prev = "coursework"
    last_mdc = prev

    before_transfer = [last_mdc]
    if extra:
        steps.append(RoadmapStep(
            id="transfer-prereqs", stage="mdc", title="Extra transfer prerequisites",
            detail="Additional common prerequisites Florida universities expect for this major.",
            duration="Alongside your last semesters", depends_on=[last_mdc], courses=extra, source_url=guide,
        ))
        before_transfer.append("transfer-prereqs")

    transfer_ids = []
    for i, t in enumerate(transfers):
        transfer_ids.append(f"transfer-{i}")
        steps.append(RoadmapStep(
            id=f"transfer-{i}", stage="transfer", title=t["program"], detail=f"{t['institution']}. {t['notes']}",
            duration="About 2 more years", depends_on=before_transfer, source_url=t["source_url"],
        ))

    # A certification MDC ties to a course hangs off the semester that teaches it.
    term_of = {c.code: f"term-{t}" for t in sorted(terms, reverse=True) for c in terms[t]}
    cert_courses = {r["cert_name"]: r["course_code"] for r in reversed(rows) if r["cert_name"]}
    gates = []
    for c in certs:
        if c["timing"] == "during":
            dep = term_of.get(cert_courses.get(c["name"], ""), last_mdc)
        elif c["timing"] == "after_degree" and transfer_ids:
            dep = transfer_ids[0]
        else:
            dep = last_mdc
        if c["timing"] != "during":
            gates.append(f"cert-{c['id']}")
        steps.append(RoadmapStep(
            id=f"cert-{c['id']}", stage="certification", title=c["name"], detail=f"{c['issuer']}. {c['why']}",
            duration=_DURATION.get(c["timing"], ""), depends_on=[dep], source_url=c["source_url"],
        ))

    career_deps = gates or transfer_ids[:1] or [last_mdc]
    for c in careers:
        steps.append(RoadmapStep(
            id=f"career-{c['soc_code']}", stage="career", title=c["title"], detail=_career_detail(c),
            duration="After graduation", depends_on=career_deps, source_url=c["source_url"],
        ))

    basis = f"MDC's course sequence guide ({source['effective_term']})" if source else "MDC program data"
    return Roadmap(
        career=major["name"],
        summary=f"A step-by-step pathway to {major['name']}, starting at Miami Dade College. "
                f"Built from {basis} and BLS career data.",
        steps=steps,
        generated_by="Tiger Cloud (MDC + BLS data)",
    )


async def prerequisite_chain(code: str) -> list[Prerequisite] | None:
    """Everything you must finish before `code`, nearest first, in one recursive query.
    None when the course is unknown or the database isn't connected."""
    if not db.pool:
        return None
    async with db.pool.acquire() as conn:
        if not await conn.fetchval("SELECT 1 FROM courses WHERE code = $1", code):
            return None
        rows = await conn.fetch(
            """
            WITH RECURSIVE chain AS (
                SELECT requires AS code, 1 AS depth FROM prerequisites WHERE course_code = $1
                UNION
                SELECT p.requires, chain.depth + 1
                FROM prerequisites p JOIN chain ON p.course_code = chain.code
                WHERE chain.depth < 20
            )
            SELECT chain.code, c.title, min(chain.depth) AS depth,
                   coalesce((SELECT array_agg(requires ORDER BY requires) FROM prerequisites
                             WHERE course_code = chain.code), '{}') AS requires
            FROM chain JOIN courses c ON c.code = chain.code
            GROUP BY chain.code, c.title
            ORDER BY depth, chain.code
            """,
            code,
        )
    return [Prerequisite(code=r["code"], title=r["title"], depth=r["depth"], requires=list(r["requires"])) for r in rows]
