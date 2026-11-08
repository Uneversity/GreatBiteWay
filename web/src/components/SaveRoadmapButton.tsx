"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountError, goToLogin, me } from "@/lib/api";

type Props = { slug: string; signedIn: boolean };

type State = "checking" | "idle" | "saving" | "saved" | "error";

const primary =
  "bg-white px-5 py-2.5 font-mono text-xs tracking-[0.16em] text-[#040b16] uppercase transition hover:bg-slate-200 disabled:cursor-wait disabled:opacity-60";
const secondary =
  "border border-white/30 px-5 py-2.5 font-mono text-xs tracking-[0.16em] text-white uppercase transition hover:bg-white/10";

/** Saves this major's roadmap to the signed-in student's account. Signed out, it links to sign-in and back. */
export function SaveRoadmapButton({ slug, signedIn }: Props) {
  const [state, setState] = useState<State>(signedIn ? "checking" : "idle");
  const [message, setMessage] = useState("");

  // Already saved? Then show that instead of offering to save again.
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    me.roadmaps()
      .then((list) => live && setState(list.some((r) => r.major_slug === slug) ? "saved" : "idle"))
      .catch(() => live && setState("idle"));
    return () => {
      live = false;
    };
  }, [signedIn, slug]);

  const loginHref = `/auth/login?returnTo=${encodeURIComponent(`/roadmap/${slug}`)}`;

  if (!signedIn) {
    return (
      <a href={loginHref} className={secondary}>
        Sign in to save this roadmap
      </a>
    );
  }

  async function save() {
    setState("saving");
    setMessage("");
    try {
      await me.saveRoadmap(slug);
      setState("saved");
    } catch (e) {
      if (e instanceof AccountError && e.status === 401) {
        goToLogin(`/roadmap/${slug}`); // session expired: sign in and come back
        return;
      }
      setState("error");
      setMessage("Couldn't save right now. Try again in a moment.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {state === "saved" ? (
        <>
          <span className="border border-emerald-300/60 px-5 py-2.5 font-mono text-xs tracking-[0.16em] text-emerald-200 uppercase">
            ✓ Saved
          </span>
          <Link href="/account" className={secondary}>
            My roadmaps
          </Link>
          <button type="button" onClick={save} className="font-mono text-[11px] tracking-[0.18em] text-white/50 uppercase underline-offset-4 hover:text-white hover:underline">
            Refresh saved copy
          </button>
        </>
      ) : (
        <button type="button" onClick={save} disabled={state === "saving" || state === "checking"} className={primary}>
          {state === "saving" ? "Saving…" : "Save this roadmap"}
        </button>
      )}
      {message && (
        <span role="alert" className="font-mono text-[11px] tracking-[0.12em] text-red-200">
          {message}
        </span>
      )}
    </div>
  );
}
