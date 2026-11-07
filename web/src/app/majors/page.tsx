import { Suspense } from "react";
import Link from "next/link";
import { Ocean } from "@/components/Ocean";
import { api, type Major } from "@/lib/api";

// Cache Components is on: uncached fetches must sit inside <Suspense> so the
// static shell renders immediately and the list streams in at request time.
async function MajorsList() {
  const result = await api.majors().then(
    (majors) => ({ majors, error: null }),
    (e) => ({ majors: [] as Major[], error: String(e) }),
  );
  if (result.error) {
    return <p className="rounded bg-red-500/80 p-3 text-sm">Backend error: {result.error}</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {result.majors.map((m) => (
        <Link
          key={m.slug}
          href={`/roadmap/${m.slug}`}
          className="rounded-2xl bg-white/10 p-5 backdrop-blur transition hover:bg-white/20"
        >
          <div className="text-xs uppercase tracking-wide opacity-70">{m.field}</div>
          <h2 className="mt-1 text-xl font-semibold">{m.name}</h2>
          <p className="mt-2 text-sm opacity-85">{m.summary}</p>
          <p className="mt-3 text-xs opacity-70">MDC: {m.mdc_program}</p>
        </Link>
      ))}
    </div>
  );
}

export default function MajorsPage() {
  return (
    <Ocean depth={0.35}>
      <main className="mx-auto max-w-5xl px-6 pt-24 pb-16">
        <h1 className="mb-6 text-3xl font-bold">Browse majors</h1>
        <Suspense fallback={<p className="opacity-70">Surfacing majors…</p>}>
          <MajorsList />
        </Suspense>
      </main>
    </Ocean>
  );
}
