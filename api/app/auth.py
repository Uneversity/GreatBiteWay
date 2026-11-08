"""Verifies Auth0 access tokens forwarded from the Next.js app.

The Next.js server gets an access token for AUTH0_AUDIENCE when the student
logs in and sends it as `Authorization: Bearer <token>`. We check its signature
against the tenant's public keys (JWKS), plus issuer, audience and expiry.
"""

from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings

bearer = HTTPBearer(auto_error=False)


def domain() -> str:
    """Accept 'tenant.us.auth0.com', 'https://tenant.us.auth0.com' or with a trailing slash."""
    d = get_settings().auth0_domain.strip()
    return d.removeprefix("https://").removeprefix("http://").rstrip("/")


@lru_cache
def _jwks(tenant: str) -> jwt.PyJWKClient:
    # PyJWKClient caches the keys and refetches when it sees an unknown key id.
    return jwt.PyJWKClient(f"https://{tenant}/.well-known/jwks.json", cache_keys=True, lifespan=3600)


def require_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    """The verified token claims; `sub` is the stable Auth0 user id."""
    s, tenant = get_settings(), domain()
    if not tenant or not s.auth0_audience:
        raise HTTPException(503, "Auth0 not configured (set AUTH0_DOMAIN and AUTH0_AUDIENCE)")
    if not creds:
        raise HTTPException(401, "Missing bearer token", headers={"WWW-Authenticate": "Bearer"})
    try:
        key = _jwks(tenant).get_signing_key_from_jwt(creds.credentials).key
        claims = jwt.decode(
            creds.credentials,
            key,
            algorithms=["RS256"],
            audience=s.auth0_audience,
            issuer=f"https://{tenant}/",
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
    except jwt.PyJWKClientError as e:
        raise HTTPException(401, f"Could not verify token signing key: {e}") from e
    except jwt.PyJWTError as e:
        raise HTTPException(401, f"Invalid token: {e}", headers={"WWW-Authenticate": "Bearer"}) from e
    return claims
