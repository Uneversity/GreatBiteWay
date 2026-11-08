"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountError, goToLogin, me, type SavedRoadmapSummary } from "@/lib/api";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** The signed-in student's saved roadmaps, newest first, with open and remove actions. */
export function MyRoadmaps() {
  const [items, setItems] = useState<SavedRoadmapSummary[] | null>(null);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<number | null>(null);

  useEffect(() => {
    me.roadmaps()
      .then(setItems)
      .catch((e) => {
        if (e instanceof AccountError && e.status === 401) {
          goToLogin("/account");
          return;
        }
        setError("Couldn't load your roadmaps. Try refreshing the page.");
      });
  }, []);

  async function remove(item: SavedRoadmapSummary) {
    if (!window.confirm(`Remove your saved ${item.major_name} roadmap?`)) return;
    setRemoving(item.id);
    try {
      await me.deleteRoadmap(item.id);
      setItems((list) => list?.filter((r) => r.id !== item.id) ?? null);
    } catch {
      setError("Couldn't remove that roadmap. Try again.");
    } finally {
      setRemoving(null);
    }
  }

  if (error) return <p className="rounded bg-red-500/80 p-3 text-sm">{error}</p>;
  if (!items) return <p className="opacity-70">Surfacing your roadmaps…</p>;

  if (items.length === 0) {
    return (
      <div className="max-w-xl">
        <p className="text-lg opacity-85">
          You haven&apos;t saved any roadmaps yet. Open a major&apos;s pathway and press Save to keep it here.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dive"
            className="bg-white px-5 py-2.5 font-mono text-xs tracking-[0.16em] text-[#040b16] uppercase transition hover:bg-slate-200"
          >
            Find my major
          </Link>
          <Link
            href="/majors"
            className="border border-white/30 px-5 py-2.5 font-mono text-xs tracking-[0.16em] text-white uppercase transition hover:bg-white/10"
          >
            Browse all majors
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((r) => (
        <div key={r.id} className="flex flex-col rounded-2xl bg-white/10 p-5 backdrop-blur">
          <div className="text-xs uppercase tracking-wide opacity-70">Saved {dateFmt.format(new Date(r.updated_at))}</div>
          <h2 className="mt-1 text-xl font-semibold">{r.major_name}</h2>
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-5 font-mono text-[11px] tracking-[0.16em] uppercase">
            <Link href={`/account/roadmaps/${r.id}`} className="text-white hover:underline underline-offset-4">
              Open →
            </Link>
            <Link href={`/roadmap/${r.major_slug}`} className="text-white/60 hover:text-white">
              Latest version
            </Link>
            <button
              type="button"
              onClick={() => remove(r)}
              disabled={removing === r.id}
              className="ml-auto uppercase text-white/50 hover:text-red-200 disabled:opacity-50"
            >
              {removing === r.id ? "Removing…" : "Remove"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
