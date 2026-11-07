import { auth0 } from "@/lib/auth0";

/** Server component. Plain <a> tags are required: /auth/* routes are handled by the proxy. */
export async function AuthButton() {
  if (!auth0) {
    return <span className="text-white/40">[ sign in ]</span>;
  }
  const session = await auth0.getSession();
  if (!session) {
    return (
      <a href="/auth/login" className="px-1 py-1 text-cyan-200 transition hover:text-white">
        [ sign in ]
      </a>
    );
  }
  return (
    <span className="flex items-center gap-3 normal-case">
      <span className="tracking-normal">{session.user.name ?? session.user.email}</span>
      <a href="/auth/logout" className="uppercase hover:text-white">
        [ out ]
      </a>
    </span>
  );
}
