import { auth0 } from "@/lib/auth0";

/** Server component. Plain <a> tags are required: /auth/* routes are handled by the proxy. */
export async function AuthButton() {
  if (!auth0) {
    return <span className="text-xs opacity-60">Auth0 not configured</span>;
  }
  const session = await auth0.getSession();
  if (!session) {
    return (
      <a href="/auth/login" className="rounded-full bg-white/90 px-4 py-1.5 text-sm font-medium text-sky-900">
        Log in
      </a>
    );
  }
  return (
    <div className="flex items-center gap-3 text-sm">
      <span>{session.user.name ?? session.user.email}</span>
      <a href="/auth/logout" className="underline">
        Log out
      </a>
    </div>
  );
}
