"use client";

import { motion } from "motion/react";
import NeonGlow from "@/components/neonblade-ui/neon-glow";
import type { Question } from "@/lib/api";
import { accentAt } from "@/lib/depth";

type Props = {
  index: number; // 1-based
  total: number;
  question: Question;
  meters: number;
  selected: number | undefined;
  inRange: string[];
  isLast: boolean;
  onSelect: (value: number) => void;
  onContinue: () => void;
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];

const view = {
  initial: { opacity: 0, y: 70 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const } },
  exit: { opacity: 0, y: -90, transition: { duration: 0.55, ease: [0.4, 0, 1, 1] as const } },
};

/**
 * One question as a full-width band: question on the left, borderless text
 * options on the right, a single footer bar. No glows except on type.
 */
export function Checkpoint({ index, total, question, meters, selected, inRange, isLast, onSelect, onContinue }: Props) {
  const accent = accentAt(meters);
  const ready = selected !== undefined;

  return (
    <motion.section {...view} className="flex h-full items-center">
      <div className="w-full border-y border-white/10 bg-[#040b16] text-white">
        <div className="mx-auto grid max-w-[1400px] gap-x-14 px-6 py-7 sm:px-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:py-9">
          <div>
            <h2 className="text-2xl leading-tight font-semibold sm:text-3xl lg:text-[2.15rem]">{question.text}</h2>
            <p className="mt-2 text-white/50">Go with your first instinct.</p>
          </div>

          <div className="mt-5 grid gap-x-10 sm:grid-cols-2 lg:mt-0">
            {question.options.map((o, i) => {
              const active = selected === o.value;
              return (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => onSelect(o.value)}
                  aria-pressed={active}
                  className="group flex items-baseline gap-3 py-2 text-left text-[17px] leading-snug"
                >
                  <span className="w-4 shrink-0 font-mono text-[11px]" style={{ color: active ? accent : "rgba(255,255,255,0.35)" }}>
                    {active ? (
                      <NeonGlow colors={accent} glowIntensity="subtle">
                        {LETTERS[i]}
                      </NeonGlow>
                    ) : (
                      LETTERS[i]
                    )}
                  </span>
                  <span className={active ? "text-white" : "text-white/65 transition-colors group-hover:text-white"}>{o.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-10 gap-y-4 px-6 py-4 font-mono text-[11px] tracking-[0.16em] uppercase sm:px-12">
            <button
              type="button"
              onClick={onContinue}
              disabled={!ready}
              className="group py-1 text-[13px] font-semibold transition-colors duration-300 disabled:cursor-not-allowed disabled:text-white/30"
              style={{ color: ready ? accent : undefined }}
            >
              {isLast ? "Reach the floor" : "Descend"}{" "}
              <span aria-hidden className="inline-block transition-transform duration-300 group-enabled:group-hover:translate-y-0.5">
                ↓
              </span>
            </button>
            <span className="text-white/40">
              {index} / {total}
            </span>
            <span className="ml-auto text-right text-[10px] text-white/40">
              <NeonGlow colors={accent} glowIntensity="subtle" className="font-semibold">
                {inRange.length}
              </NeonGlow>{" "}
              {inRange.length === 1 ? "field" : "fields"} still in range
              <span className="hidden md:inline"> · {inRange.join(" · ")}</span>
            </span>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
