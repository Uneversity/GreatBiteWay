"""/majors carries card highlights: the main career and the MDC time and cost."""

from fastapi.testclient import TestClient

from app import mdc_info
from app.main import app


def test_every_major_has_career_and_study_highlights():
    with TestClient(app) as c:
        majors = c.get("/majors").json()
    assert len(majors) == 15
    for m in majors:
        career, study = m["career"], m["study"]
        assert career and career["median_pay"] > 0 and career["source_url"].startswith("https://www.bls.gov/")
        assert study and study["credits"] >= 60 and study["years"] in (2, 4)
        assert study["source_url"].startswith("https://www.mdc.edu/")
        assert study["cost_source_url"] == mdc_info.TUITION_URL


def test_study_paths_and_costs():
    with TestClient(app) as c:
        by = {m["slug"]: m["study"] for m in c.get("/majors").json()}
    assert by["psychology"] == {**by["psychology"], "path": "A.A.", "credits": 60, "years": 2, "est_cost": 7093}
    assert by["cybersecurity"]["path"] == "A.S. then B.S." and by["cybersecurity"]["est_cost"] == 14887
    assert by["culinary-arts"]["path"] == "A.S."  # the B.A.S. is an optional pathway, not the major's program
    assert by["biological-sciences"]["path"] == "B.S."
