"use client";

import Link from "next/link";
import { useEffect, useState, type MouseEvent } from "react";
import type { Major } from "@/lib/api";
import { MajorGlyph } from "./MajorGlyph";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** "6% (Faster than average)" -> { pct: "+6%", label: "Faster than average" } */
function parseOutlook(outlook: string) {
  const m = outlook.match(/^\s*(-?\d+(?:\.\d+)?)%\s*(?:\((.*)\))?/);
  if (!m) return { pct: null, label: outlook };
  const n = Number(m[1]);
  return { pct: `${n > 0 ? "+" : ""}${m[1]}%`, label: (m[2] ?? "").split(",")[0].trim(), down: n < 0 };
}

/**
 * A major in the browse grid. The grid cell keeps a fixed height; when the card
 * opens (hover with a mouse, keyboard focus, or a first tap on touch) the card
 * itself grows downward over the row below, so nothing else on the page moves.
 */
export function MajorCard({ major }: { major: Major }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [tapped, setTapped] = useState(false);
  const [canHover, setCanHover] = useState(true);
  const open = hovered || focused || tapped;

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setCanHover(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Touch: the first tap opens the card, a second tap follows the link.
  const onLinkClick = (e: MouseEvent) => {
    if (!canHover && !tapped) {
      e.preventDefault();
      setTapped(true);
    }
  };

  // A tap anywhere else closes a tapped-open card.
  useEffect(() => {
    if (!tapped) return;
    const close = () => setTapped(false);
    const t = window.setTimeout(() => document.addEventListener("click", close, { once: true }), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("click", close);
    };
  }, [tapped]);

  const { career, study } = major;
  const outlook = career ? parseOutlook(career.outlook) : null;

  return (
    <div className="relative h-44">
      <article
        data-open={open ? "" : undefined}
        onMouseEnter={() => canHover && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setFocused(false)}
        // Background swaps fast so the card below never shows through while this one grows over it.
        className={`absolute inset-x-0 top-0 flex min-h-full flex-col border text-white backdrop-blur transition-[background-color,border-color,box-shadow,transform] duration-100 ${
          open
            ? "z-30 -translate-y-1 border-white/40 bg-[rgb(37,133,179)] shadow-[0_24px_50px_rgba(2,6,23,0.45)]"
            : "z-0 border-white/15 bg-white/10 hover:bg-white/15"
        }`}
      >
        {/* Always visible */}
        <div className="flex flex-1 flex-col p-5">
          <div className="font-mono text-[10px] tracking-[0.18em] text-white/60 uppercase">{major.field}</div>
          <h2 className="mt-1.5 text-2xl leading-tight font-semibold">
            <Link
              href={`/roadmap/${major.slug}`}
              onClick={onLinkClick}
              className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
            >
              {major.name}
            </Link>
          </h2>
          <p className="mt-2 line-clamp-2 text-[15px] leading-snug text-white/80">{major.summary}</p>
        </div>

        {/* Revealed when open: grows from 0 to its natural height */}
        <div
          className={`grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
          aria-hidden={!open}
        >
          <div className="overflow-hidden">
            <div className="border-t border-white/20 px-5 pt-4 pb-4">
              <div className="flex items-center gap-4">
                <MajorGlyph slug={major.slug} className="h-14 w-14 shrink-0 text-white" />
                {career && (
                  <div className="min-w-0">
                    <div className="text-[28px] leading-none font-semibold tabular-nums">{money.format(career.median_pay)}</div>
                    <div className="mt-1 font-mono text-[10px] tracking-[0.14em] text-white/70 uppercase">
                      median pay
                      {outlook?.pct && (
                        <span className={outlook.down ? "text-amber-200" : "text-emerald-200"}>
                          {" "}
                          · {outlook.pct} jobs
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {study && (
                <div className="mt-3 text-[15px] font-semibold tabular-nums">
                  {study.path.replace(" then ", " → ")} · {study.years} yrs · ≈ {money.format(study.est_cost)}
                  <span className="font-normal text-white/70"> at MDC</span>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between font-mono text-[10px] tracking-[0.14em] uppercase">
                <span className="flex gap-3 text-white/60">
                  {career && (
                    <a href={career.source_url} target="_blank" rel="noreferrer" tabIndex={open ? 0 : -1} className="relative z-10 hover:text-white">
                      BLS ↗
                    </a>
                  )}
                  {study && (
                    <a href={study.cost_source_url} target="_blank" rel="noreferrer" tabIndex={open ? 0 : -1} className="relative z-10 hover:text-white">
                      MDC ↗
                    </a>
                  )}
                </span>
                <span>Roadmap →</span>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
