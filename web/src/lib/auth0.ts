import { Auth0Client } from "@auth0/nextjs-auth0/server";

/**
 * Auth0 is optional while prototyping: if the env vars aren't filled in yet,
 * `auth0` is null and the app runs without login.
 */
export const authEnabled = Boolean(
  process.env.AUTH0_DOMAIN &&
    process.env.AUTH0_CLIENT_ID &&
    process.env.AUTH0_CLIENT_SECRET &&
    process.env.AUTH0_SECRET,
);

export const auth0 = authEnabled
  ? new Auth0Client({
      authorizationParameters: {
        // Lets FastAPI verify the access token we forward to it.
        audience: process.env.AUTH0_AUDIENCE,
        scope: "openid profile email offline_access",
      },
    })
  : null;
