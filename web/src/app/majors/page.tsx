import { Suspense } from "react";
import { MajorCard } from "@/components/majors/MajorCard";
import { MdcSpinner } from "@/components/MdcSpinner";
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
    return <p className="bg-red-500/80 p-3 text-sm">Backend error: {result.error}</p>;
  }
  return (
    <>
      <p className="mb-6 font-mono text-[11px] tracking-[0.18em] text-white/60 uppercase">
        {result.majors.length} pathways
      </p>
      {/* Bottom padding leaves room for cards in the last row to open downward. */}
      <div className="grid gap-5 pb-48 sm:grid-cols-2 lg:grid-cols-3">
        {result.majors.map((m) => (
          <MajorCard key={m.slug} major={m} />
        ))}
      </div>
    </>
  );
}

export default function MajorsPage() {
  return (
    <Ocean depth={0.35}>
      <main className="mx-auto max-w-6xl px-6 pt-24 pb-16">
        <h1 className="mb-2 text-4xl font-semibold sm:text-5xl">Browse majors</h1>
        <Suspense
          fallback={
            <div className="flex min-h-[50vh] items-center justify-center">
              <MdcSpinner
                label="Loading majors"
                size="h-12"
                className="text-white"
                caption={<span className="font-mono text-[11px] tracking-[0.18em] text-white/60 uppercase">Surfacing majors…</span>}
              />
            </div>
          }
        >
          <MajorsList />
        </Suspense>
      </main>
    </Ocean>
  );
}
