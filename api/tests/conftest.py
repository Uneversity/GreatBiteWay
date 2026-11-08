"""Keep tests offline: no real Gemini calls and no writes to Tiger Cloud, even when
api/.env has keys. Tests marked `live` (the opt-in integration test) keep them."""

import pytest

from app.config import get_settings
from app.services import gemini


def pytest_configure(config):
    config.addinivalue_line("markers", "live: uses the real DATABASE_URL / GEMINI_API_KEY from api/.env")


@pytest.fixture(autouse=True)
def offline(request, monkeypatch):
    if request.node.get_closest_marker("live"):
        yield
        return
    monkeypatch.setattr(get_settings(), "database_url", "")
    monkeypatch.setattr(gemini, "_client", lambda: None)
    yield
