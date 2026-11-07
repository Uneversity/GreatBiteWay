"""Swarms API: a sequential multi-agent roadmap generator.

Agents are described as JSON and POSTed to api.swarms.world. The response
includes the output plus usage/cost, which we can show in the UI for the
Swarms prize. Check https://docs.swarms.world for the current request/response
shape before relying on the parsing below.
"""

import json

import httpx

from app.config import get_settings

SWARMS_URL = "https://api.swarms.world/v1/swarm/completions"


def _agent(name: str, description: str, system_prompt: str) -> dict:
    return {
        "agent_name": name,
        "description": description,
        "system_prompt": system_prompt,
        "model_name": get_settings().swarms_model,
        "role": "worker",
        "max_loops": 1,
        "max_tokens": 2048,
        "temperature": 0.3,
    }


ROADMAP_SCHEMA_HINT = (
    'Return ONLY JSON: {"summary": str, "steps": [{"id": str, "stage": "mdc"|"transfer"|"certification"|"career", '
    '"title": str, "detail": str, "duration": str, "depends_on": [str]}]}'
)


async def generate_roadmap(career: str, catalog_rows: list[dict]) -> dict | None:
    """Returns {"summary", "steps", "cost"} or None if no key / on failure."""
    settings = get_settings()
    if not settings.swarms_api_key:
        return None

    payload = {
        "name": "mdc-roadmap-swarm",
        "description": "Builds a step-by-step education and career roadmap starting at Miami Dade College",
        "swarm_type": "SequentialWorkflow",
        "max_loops": 1,
        "agents": [
            _agent("CareerResearcher", "Researches the career",
                   "Describe the education, certifications and experience needed for the given career."),
            _agent("MDCCoursePlanner", "Maps requirements to MDC courses",
                   "Using ONLY the MDC catalog rows provided, map requirements to MDC programs and courses."),
            _agent("TransferChecker", "Checks timeline and transfer path",
                   "Add realistic semester timing and transfer options (MDC bachelor's or 2+2 partners)."),
            _agent("Reviewer", "Catches mistakes and formats output",
                   f"Fix errors and inconsistencies. {ROADMAP_SCHEMA_HINT}"),
        ],
        "task": f"Career goal: {career}\nMDC catalog rows:\n{json.dumps(catalog_rows)}",
    }

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(SWARMS_URL, json=payload, headers={"x-api-key": settings.swarms_api_key})
    if resp.status_code != 200:
        return None
    data = resp.json()

    # TODO: confirm the exact response shape; the last agent's output should be our JSON.
    output = data.get("output")
    last = output[-1] if isinstance(output, list) and output else output
    text = last.get("content") if isinstance(last, dict) else last
    try:
        parsed = json.loads(text) if isinstance(text, str) else text
    except json.JSONDecodeError:
        return None
    return {**parsed, "cost": data.get("usage", {}).get("billing_info") or data.get("usage")}
