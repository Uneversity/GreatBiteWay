// Server-side only: forwards a request to FastAPI with the student's Auth0 access token.
// The token stays on the Next.js server; the browser only ever has the session cookie.
import { auth0 } from "@/lib/auth0";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function error(status: number, detail: string) {
  return Response.json({ detail }, { status });
}

/** Calls `path` on FastAPI as the logged-in student and relays the response as-is. */
export async function forwardAsUser(path: string, init: RequestInit = {}): Promise<Response> {
  if (!auth0) return error(503, "Sign-in isn't configured on this server");
  if (!(await auth0.getSession())) return error(401, "Sign in first");

  let token: string;
  try {
    ({ token } = await auth0.getAccessToken());
  } catch {
    // Expired refresh token, revoked session, etc. Signing in again fixes it.
    return error(401, "Your session expired. Sign in again.");
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...init.headers, Authorization: `Bearer ${token}` },
    });
  } catch {
    return error(502, "The pathways API is unreachable");
  }
  // 204 has no body; everything else is relayed with FastAPI's status and JSON.
  return new Response(res.status === 204 ? null : await res.text(), {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}
