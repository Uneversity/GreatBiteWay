"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { MdcSpinner } from "@/components/MdcSpinner";

/** Long enough that the spinner reads as intentional rather than a flicker. */
const MIN_SHOW_MS = 450;
const FADE_MS = 400;

/**
 * Black cover with the MDC spinner shown every time you arrive at the major
 * finder, not only on the first page load (that one is BootSplash). Cache
 * Components keeps this page alive while hidden, so the cover resets itself
 * when the page is hidden and runs again when it is shown. It lifts shortly
 * after `ready` (quiz loaded) is true.
 * Sits under the header (z-50) so the nav stays usable.
 */
export function EntryCover({ ready }: { ready: boolean }) {
  const [state, setState] = useState<"shown" | "fading" | "gone">("shown");

  // Runs when the page is hidden (navigating away): cover it again for next time.
  useLayoutEffect(() => () => setState("shown"), []);

  // Once the quiz is loaded, give the ocean a moment to draw, then fade out.
  // Plain timers, not animation frames: those never fire in a hidden tab.
  useEffect(() => {
    if (!ready || state !== "shown") return;
    const t = window.setTimeout(() => setState("fading"), MIN_SHOW_MS);
    return () => window.clearTimeout(t);
  }, [ready, state]);

  useEffect(() => {
    if (state !== "fading") return;
    const t = window.setTimeout(() => setState("gone"), FADE_MS);
    return () => window.clearTimeout(t);
  }, [state]);

  if (state === "gone") return null;

  return (
    <div
      aria-busy={state === "shown"}
      className="fixed inset-0 z-[45] flex items-center justify-center bg-black transition-opacity ease-out"
      style={{ opacity: state === "fading" ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
    >
      <MdcSpinner label="Loading the major finder" size="h-14 sm:h-16" className="text-white" />
    </div>
  );
}
