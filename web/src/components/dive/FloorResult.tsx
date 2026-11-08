"use client";

import Link from "next/link";
import { motion } from "motion/react";
import NeonGlow from "@/components/neonblade-ui/neon-glow";
import type { FieldMatch } from "@/lib/api";
import { MAX_METERS, accentAt } from "@/lib/depth";

type Props = {
  matches: FieldMatch[];
  /** Every field still plausible given the answers (top matches first). */
  inRange: FieldMatch[];
  answered: number;
  total: number;
  onRetake: () => void;
};

function intro(answered: number, total: number) {
  if (answered >= total) return "Based on your answers, these pathways line up best with how you like to think and work.";
  if (answered === 0)
    return "You dove straight to the bottom, so every field is still on the table. Here's where to start looking, or retake the dive for a real match.";
  return `You answered ${answered} of ${total} checkpoints, so this is a rough reading. Every major still in range is below; answer more for a sharper match.`;
}

const RANK = ["Strongest match", "Also a fit", "Worth a look"];

const view = {
  initial: { opacity: 0, y: 70 },
  animate: { opacity: 1, y: 0, transition: { duration: 1, ease: [0.22, 1, 0.36, 1] as const } },
  exit: { opacity: 0, y: 90, transition: { duration: 0.55, ease: [0.4, 0, 1, 1] as const } },
};

export function FloorResult({ matches, inRange, answered, total, onRetake }: Props) {
  const accent = accentAt(MAX_METERS);
  const [best, ...rest] = matches;
  const shown = new Set(matches.map((m) => m.slug));
  const others = inRange.filter((m) => !shown.has(m.slug));

  return (
    <motion.section {...view} className="h-full overflow-y-auto py-10">
      <div className="flex min-h-full items-center">
        <div className="w-full text-white">
          <div className="mx-auto max-w-[1400px] px-6 sm:px-12">
          <h2 className="max-w-3xl text-4xl leading-[1.05] font-semibold sm:text-6xl">
            You&apos;ve reached the bottom.{" "}
            <em className="font-light">
              <NeonGlow colors={accent} glowIntensity="normal" className="not-italic">
                Here&apos;s where you fit.
              </NeonGlow>
            </em>
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/65">{intro(answered, total)}</p>
          </div>

          {best && (
            <div className="mt-8 w-full border-y border-white/10 bg-[#040b16]">
              <div className="mx-auto grid max-w-[1400px] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
              <div className="px-6 py-8 sm:px-12" style={{ boxShadow: `inset 3px 0 0 ${accent}` }}>
                <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.18em] text-white/45 uppercase">
                  <span>{RANK[0]}</span>
                  <ScoreBar score={best.score} accent={accent} />
                </div>
                <h3 className="mt-3 text-4xl font-semibold">
                  <NeonGlow colors="#ffffff" glowColor={accent} glowIntensity="subtle">
                    {best.name}
                  </NeonGlow>
                </h3>
                <p className="mt-3 max-w-md text-white/65">
                  Start with an associate degree at MDC, then transfer or go straight into an entry-level role. Your roadmap lays
                  out every step.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    href={`/roadmap/${best.slug}`}
                    className="bg-white px-5 py-2.5 font-mono text-xs tracking-[0.16em] text-[#040b16] uppercase transition hover:bg-slate-200"
                  >
                    Explore this pathway
                  </Link>
                  <Link
                    href="/majors"
                    className="border border-white/30 px-5 py-2.5 font-mono text-xs tracking-[0.16em] text-white uppercase transition hover:bg-white/10"
                  >
                    Browse all majors
                  </Link>
                </div>
              </div>

              <div className="grid divide-y divide-white/10 border-t border-white/10 bg-[#081426] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:border-t-0 lg:border-l">
                {rest.map((m, i) => (
                  <Link key={m.slug} href={`/roadmap/${m.slug}`} className="group px-6 py-6 transition hover:bg-[#0d2142] sm:px-8 lg:py-8">
                    <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.18em] text-white/45 uppercase">
                      <span>{RANK[i + 1] ?? "Also in range"}</span>
                      <ScoreBar score={m.score} accent={accent} />
                    </div>
                    <div className="mt-2 text-2xl font-semibold">{m.name}</div>
                    <div className="mt-2 font-mono text-[11px] tracking-[0.16em] text-white/50 uppercase group-hover:text-white/85">
                      View pathway →
                    </div>
                  </Link>
                ))}
              </div>
              </div>
            </div>
          )}

          {others.length > 0 && (
            <div className="mx-auto max-w-[1400px] px-6 pt-8 sm:px-12">
              <div className="font-mono text-[10px] tracking-[0.18em] text-white/45 uppercase">
                Also still in range · {others.length} {others.length === 1 ? "major" : "majors"}
              </div>
              <ul className="mt-3 flex flex-wrap gap-2">
                {others.map((m) => (
                  <li key={m.slug}>
                    <Link
                      href={`/roadmap/${m.slug}`}
                      className="group flex items-center gap-3 border border-white/15 bg-[#040b16]/70 px-4 py-2.5 transition hover:border-white/40 hover:bg-[#0d2142]"
                    >
                      <span className="text-[15px] text-white/85 group-hover:text-white">{m.name}</span>
                      <ScoreBar score={m.score} accent={accent} />
                      <span className="font-mono text-[10px] tracking-[0.16em] text-white/40 uppercase group-hover:text-white/80">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mx-auto max-w-[1400px] px-6 sm:px-12">
          <button
            type="button"
            onClick={onRetake}
            className="mt-8 font-mono text-[11px] tracking-[0.18em] text-white/50 uppercase underline-offset-4 hover:text-white hover:underline"
          >
            Retake the dive ↑
          </button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function ScoreBar({ score, accent }: { score: number; accent: string }) {
  const filled = Math.round(score * 5);
  return (
    <span className="flex gap-1" title={`${Math.round(score * 100)}%`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className="block h-1.5 w-3" style={{ background: i < filled ? accent : "rgba(255,255,255,0.15)" }} />
      ))}
    </span>
  );
}
