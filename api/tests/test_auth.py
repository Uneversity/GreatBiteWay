"""Auth0 token checks and the /me account routes.

Tokens are signed with a throwaway RSA key and the JWKS lookup is pointed at
it, so these run offline. The live test exercises the account routes against
the real Tiger Cloud database (TIGER_TESTS=1) and cleans up after itself.
"""

import os
import time
import types

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app import auth
from app.config import get_settings
from app.main import app

DOMAIN, AUDIENCE = "shark-test.us.auth0.com", "https://api.sharkpathways.test"
KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def token(sub="auth0|student1", key=KEY, **overrides) -> str:
    now = int(time.time())
    claims = {"sub": sub, "iss": f"https://{DOMAIN}/", "aud": AUDIENCE, "iat": now, "exp": now + 600, **overrides}
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": "test-key"})


@pytest.fixture
def auth0_env(monkeypatch):
    monkeypatch.setattr(get_settings(), "auth0_domain", f"https://{DOMAIN}/")  # sloppy form on purpose
    monkeypatch.setattr(get_settings(), "auth0_audience", AUDIENCE)
    jwks = types.SimpleNamespace(get_signing_key_from_jwt=lambda _t: types.SimpleNamespace(key=KEY.public_key()))
    monkeypatch.setattr(auth, "_jwks", lambda _tenant: jwks)


def bearer(t: str) -> dict:
    return {"Authorization": f"Bearer {t}"}


def test_domain_is_normalized(auth0_env):
    assert auth.domain() == DOMAIN


def test_valid_token_returns_claims(auth0_env):
    from fastapi.security import HTTPAuthorizationCredentials

    claims = auth.require_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token()))
    assert claims["sub"] == "auth0|student1"


@pytest.mark.parametrize("bad", [
    token(exp=int(time.time()) - 10),
    token(aud="https://some-other-api"),
    token(iss="https://evil.example.com/"),
    token(key=OTHER_KEY),
    "not-a-jwt",
])
def test_bad_tokens_are_rejected(auth0_env, bad):
    with TestClient(app) as c:
        r = c.get("/me", headers=bearer(bad))
    assert r.status_code == 401


def test_missing_token_is_401(auth0_env):
    with TestClient(app) as c:
        assert c.get("/me/roadmaps").status_code == 401


def test_unconfigured_auth_is_503():
    with TestClient(app) as c:
        assert c.get("/me", headers=bearer(token())).status_code == 503


def test_valid_token_without_database_is_503(auth0_env):
    with TestClient(app) as c:
        assert c.get("/me", headers=bearer(token())).status_code == 503


def test_health_reports_auth0(auth0_env):
    with TestClient(app) as c:
        assert c.get("/health").json()["integrations"]["auth0"] is True


@pytest.mark.live
@pytest.mark.skipif(os.getenv("TIGER_TESTS") != "1", reason="set TIGER_TESTS=1 to run against DATABASE_URL")
def test_account_routes_against_tiger(auth0_env, monkeypatch):
    from app.services import gemini

    monkeypatch.setattr(gemini, "_client", lambda: None)  # roadmap explanations aren't under test here
    me, other = bearer(token("pytest|me")), bearer(token("pytest|other"))
    with TestClient(app) as c:
        try:
            saved = c.post("/me/roadmaps", json={"major_slug": "cybersecurity"}, headers=me)
            assert saved.status_code == 201, saved.text
            body = saved.json()
            assert body["major_name"] == "Cybersecurity" and body["roadmap"]["generated_by"].startswith("Tiger")

            again = c.post("/me/roadmaps", json={"major_slug": "cybersecurity"}, headers=me).json()
            assert again["id"] == body["id"]  # one copy per major; saving refreshes it
            assert c.post("/me/roadmaps", json={"major_slug": "nope"}, headers=me).status_code == 404

            assert [r["major_slug"] for r in c.get("/me/roadmaps", headers=me).json()] == ["cybersecurity"]
            assert c.get(f"/me/roadmaps/{body['id']}", headers=other).status_code == 404  # not yours
            assert c.delete(f"/me/roadmaps/{body['id']}", headers=other).status_code == 404

            q = c.post("/me/quiz-results", json={"answers": [{"question_id": "q_impact", "value": 3}]}, headers=me)
            assert q.status_code == 201 and q.json()["top_matches"][0]["slug"]
            assert len(c.get("/me/quiz-results", headers=me).json()) == 1
            assert c.get("/me", headers=me).json() == {"user_id": "pytest|me", "saved_roadmaps": 1, "quiz_results": 1}

            assert c.delete(f"/me/roadmaps/{body['id']}", headers=me).status_code == 204
            assert c.get("/me/roadmaps", headers=me).json() == []
        finally:
            import asyncio

            from app.services import db

            async def cleanup():
                await db.connect()
                await db.pool.execute("DELETE FROM saved_roadmaps WHERE user_id LIKE 'pytest|%'")
                await db.pool.execute("DELETE FROM quiz_results WHERE user_id LIKE 'pytest|%'")
                await db.disconnect()

            asyncio.run(cleanup())
