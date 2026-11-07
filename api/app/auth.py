"""Verifies Auth0 access tokens forwarded from the Next.js app."""

from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings

bearer = HTTPBearer(auto_error=False)


@lru_cache
def _jwks() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"https://{get_settings().auth0_domain}/.well-known/jwks.json")


def require_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    s = get_settings()
    if not s.auth0_domain:
        raise HTTPException(503, "Auth0 not configured")
    if not creds:
        raise HTTPException(401, "Missing bearer token")
    try:
        key = _jwks().get_signing_key_from_jwt(creds.credentials).key
        return jwt.decode(
            creds.credentials,
            key,
            algorithms=["RS256"],
            audience=s.auth0_audience,
            issuer=f"https://{s.auth0_domain}/",
        )
    except jwt.PyJWTError as e:
        raise HTTPException(401, f"Invalid token: {e}") from e
