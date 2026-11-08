import { Suspense } from "react";
import { MyRoadmaps } from "@/components/MyRoadmaps";
import { Ocean } from "@/components/Ocean";
import { auth0 } from "@/lib/auth0";

// Reads the session, so it streams in behind the Suspense boundary below.
async function Account() {
  if (!auth0) {
    return <p className="opacity-80">Sign-in isn&apos;t set up on this server yet.</p>;
  }
  const session = await auth0.getSession();
  if (!session) {
    return (
      <div className="max-w-xl">
        <p className="text-lg opacity-85">Sign in to see the roadmaps you&apos;ve saved.</p>
        <a
          href={`/auth/login?returnTo=${encodeURIComponent("/account")}`}
          className="mt-6 inline-block bg-white px-5 py-2.5 font-mono text-xs tracking-[0.16em] text-[#040b16] uppercase transition hover:bg-slate-200"
        >
          Sign in
        </a>
      </div>
    );
  }
  return <MyRoadmaps />;
}

export default function AccountPage() {
  return (
    <Ocean depth={0.5}>
      <main className="mx-auto max-w-5xl px-6 pt-24 pb-16">
        <p className="text-sm uppercase tracking-wide opacity-70">Your account</p>
        <h1 className="mb-6 text-3xl font-bold">My roadmaps</h1>
        <Suspense fallback={<p className="opacity-70">Surfacing your roadmaps…</p>}>
          <Account />
        </Suspense>
      </main>
    </Ocean>
  );
}
