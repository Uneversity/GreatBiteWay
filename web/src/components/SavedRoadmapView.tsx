"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RoadmapDescent, RoadmapLoading } from "@/components/roadmap/RoadmapDescent";
import { AccountError, goToLogin, me, type SavedRoadmap } from "@/lib/api";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" });
const EYEBROW = "Saved pathway";

const secondary =
  "border border-white/30 px-5 py-2.5 font-mono text-xs tracking-[0.16em] text-white uppercase transition hover:bg-white/10";

/** One saved roadmap, exactly as it was when the student saved it. */
export function SavedRoadmapView({ id }: { id: number }) {
  const [saved, setSaved] = useState<SavedRoadmap | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    me.roadmap(id)
      .then(setSaved)
      .catch((e) => {
        if (e instanceof AccountError && e.status === 401) {
          goToLogin(`/account/roadmaps/${id}`);
          return;
        }
        setError(e instanceof AccountError && e.status === 404 ? "That roadmap isn't in your account." : "Couldn't load this roadmap.");
      });
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#040d1a] px-6 pt-24 text-white sm:px-12">
        <p className="inline-block bg-red-500/80 p-3 text-sm">{error}</p>
        <div className="mt-6">
          <Link href="/account" className={secondary}>
            ← My roadmaps
          </Link>
        </div>
      </div>
    );
  }
  if (!saved) return <RoadmapLoading eyebrow={EYEBROW} />;

  return (
    <RoadmapDescent
      roadmap={saved.roadmap}
      eyebrow={EYEBROW}
      meta={
        <>
          Saved {dateFmt.format(new Date(saved.updated_at))} · {saved.roadmap.generated_by}
        </>
      }
      actions={
        <>
          <Link href="/account" className={secondary}>
            ← My roadmaps
          </Link>
          <Link href={`/roadmap/${saved.major_slug}`} className={secondary}>
            See latest version
          </Link>
        </>
      }
    />
  );
}
