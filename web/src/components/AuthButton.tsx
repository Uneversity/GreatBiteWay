import Link from "next/link";
import { auth0 } from "@/lib/auth0";

/** Server component. Plain <a> tags are required for /auth/*: those routes are handled by the proxy. */
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
    <span className="flex items-center gap-3 whitespace-nowrap normal-case">
      <Link href="/account" className="uppercase transition hover:text-white">
        [ my roadmaps ]
      </Link>
      <span className="hidden max-w-48 truncate tracking-normal xl:inline">{session.user.name ?? session.user.email}</span>
      <a href="/auth/logout" className="uppercase hover:text-white">
        [ out ]
      </a>
    </span>
  );
}
