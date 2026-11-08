"use client";

import { useEffect, useState } from "react";
import { MdcSpinner } from "@/components/MdcSpinner";
import { bootPending, markBooted, onBootChange } from "@/lib/boot";

/** Never keep people staring at the splash if the backend hangs. */
const MAX_WAIT_MS = 15000;
const FADE_MS = 400;

/**
 * Black full-screen cover with the MDC spinner. It is server-rendered, so it is
 * visible from the first paint, and fades out once the app has hydrated, fonts
 * are ready and every `holdBoot()` (e.g. the quiz fetch) has been released.
 * Render it after the page content so the page's effects register their holds first.
 */
export function BootSplash() {
  const [state, setState] = useState<"shown" | "fading" | "gone">("shown");

  useEffect(() => {
    let finished = false;
    let fontsReady = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      markBooted();
      setState("fading");
      window.setTimeout(() => setState("gone"), FADE_MS);
    };
    const check = () => {
      if (fontsReady && !bootPending()) finish();
    };

    const unsubscribe = onBootChange(check);
    const timeout = window.setTimeout(finish, MAX_WAIT_MS);
    document.fonts.ready.then(() => {
      fontsReady = true;
      // Wait one frame so the page has painted underneath before revealing it.
      requestAnimationFrame(check);
    });

    return () => {
      unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  if (state === "gone") return null;

  return (
    <div
      id="boot-splash"
      aria-busy={state === "shown"}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black transition-opacity ease-out"
      style={{ opacity: state === "fading" ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
    >
      <MdcSpinner label="Loading Shark Pathways" size="h-14 sm:h-16" className="text-white" />
      {/* Without JavaScript nothing would ever hide the splash. */}
      <noscript>
        <style>{"#boot-splash{display:none}"}</style>
      </noscript>
    </div>
  );
}
