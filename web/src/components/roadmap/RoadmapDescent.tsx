"use client";

import Link from "next/link";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import NeonGlow from "@/components/neonblade-ui/neon-glow";
import type { Roadmap, RoadmapStep } from "@/lib/api";
import { MAX_METERS, checkpointMeters, clamp, colorAt, rgb, zoneAt } from "@/lib/depth";
import { layerSteps } from "@/lib/roadmapLayout";

/**
 * A roadmap drawn as a dive. The page is one long water column: the hero floats
 * at the surface with the waterline just under it, each layer of the flowchart
 * is a depth band that darkens as you scroll, and the final steps rest on the
 * ocean floor. Plain CSS and SVG, no WebGL: the only motion is a slow drift on
 * the waterline and a crawl along the connectors.
 */

type Props = {
  roadmap: Roadmap;
  /** Small mono label above the title, e.g. "Your pathway". */
  eyebrow: string;
  /** Extra mono text in the deck bar, e.g. when it was saved. */
  meta?: ReactNode;
  /** Buttons for the deck bar: save, back to account, etc. */
  actions?: ReactNode;
};

const STAGE: Record<RoadmapStep["stage"], { label: string; color: string }> = {
  mdc: { label: "At MDC", color: "#38bdf8" },
  transfer: { label: "Transfer", color: "#a5b4fc" },
  certification: { label: "Certification", color: "#fbbf24" },
  career: { label: "Career", color: "#34d399" },
};

const SKY_TOP = "#e9f4fb";
const SKY_BOTTOM = "#b7d9f1";
const DECK = "#040b16";

/** Water colour for a band boundary. The surface water reads teal, never the pale hero tint. */
function water(m: number) {
  return rgb(colorAt(clamp(m, 200, MAX_METERS)));
}

const fmt = new Intl.NumberFormat("en-US");

type EdgeGeom = { id: string; d: string; color: string; x2: number; y2: number; x1: number; y1: number };

export function RoadmapDescent({ roadmap, eyebrow, meta, actions }: Props) {
  const layers = useMemo(() => layerSteps(roadmap.steps), [roadmap.steps]);
  // marks[0] is the surface, marks[i + 1] the top of layer i, the last the floor.
  const marks = useMemo(() => checkpointMeters(layers.length + 2), [layers.length]);
  const notes = useMemo(
    () => new Map((roadmap.explanation?.step_notes ?? []).map((n) => [n.id, n.note])),
    [roadmap.explanation],
  );
  // Connectors are drawn in an SVG over the water column from the cards' measured boxes.
  const column = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  const [edges, setEdges] = useState<EdgeGeom[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const register = useCallback((id: string) => {
    return (el: HTMLElement | null) => {
      if (el) cards.current.set(id, el);
      else cards.current.delete(id);
    };
  }, []);

  useLayoutEffect(() => {
    const root = column.current;
    if (!root) return;
    const measure = () => {
      const base = root.getBoundingClientRect();
      const box = (id: string) => {
        const el = cards.current.get(id);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left - base.left + r.width / 2, top: r.top - base.top, bottom: r.bottom - base.top };
      };
      const next: EdgeGeom[] = [];
      for (const s of roadmap.steps) {
        const to = box(s.id);
        if (!to) continue;
        for (const dep of s.depends_on) {
          const from = box(dep);
          if (!from) continue;
          const x1 = from.x;
          const y1 = from.bottom;
          const x2 = to.x;
          const y2 = to.top;
          const bend = Math.max(24, (y2 - y1) * 0.5);
          next.push({
            id: `${dep}-${s.id}`,
            d: `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`,
            color: STAGE[s.stage].color,
            x1,
            y1,
            x2,
            y2,
          });
        }
      }
      setEdges(next);
      setSize({ w: base.width, h: base.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    cards.current.forEach((el) => ro.observe(el));
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [roadmap.steps, layers]);

  const stagesPresent = Array.from(new Set(roadmap.steps.map((s) => s.stage)));
  const surfaceWater = water(marks[1] ?? 200);
  const floorColor = water(MAX_METERS);

  return (
    <div className="relative min-h-screen text-white" style={{ background: floorColor }}>
      {/* ---- Surface: sky, hero, waterline ----------------------------------- */}
      <section className="relative text-slate-900" style={{ background: `linear-gradient(180deg, ${SKY_TOP} 0%, ${SKY_BOTTOM} 100%)` }}>
        <div className="mx-auto max-w-[1400px] px-6 pt-24 pb-28 sm:px-12 lg:pt-28 lg:pb-32">
          <div className="font-mono text-[11px] tracking-[0.18em] text-slate-700 uppercase">
            {eyebrow} · {roadmap.steps.length} steps · {layers.length} depths
          </div>
          <h1 className="mt-5 max-w-4xl text-[2.6rem] leading-[1.02] font-semibold sm:text-6xl lg:text-7xl">
            {roadmap.career}
            <em className="mt-3 block text-[0.5em] leading-tight font-light">
              Start at MDC.{" "}
              <NeonGlow colors="#0b4f8a" glowColor="#38bdf8" glowIntensity="normal" className="not-italic">
                Follow the steps to the floor.
              </NeonGlow>
            </em>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-700">{roadmap.summary}</p>
        </div>
        <Waterline color={surfaceWater} />
      </section>

      {/* ---- Water column: deck bar, one band per layer, connectors ------------ */}
      <div ref={column} className="relative">
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10"
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w || 1} ${size.h || 1}`}
          preserveAspectRatio="none"
        >
          {edges.map((e) => (
            <g key={e.id}>
              <path d={e.d} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={3} />
              <path d={e.d} fill="none" stroke={e.color} strokeWidth={1.5} className="edge-flow" opacity={0.9} />
              <circle cx={e.x1} cy={e.y1} r={3} fill="rgba(255,255,255,0.55)" />
              <circle cx={e.x2} cy={e.y2} r={4} fill={e.color} />
            </g>
          ))}
        </svg>

        {/* light from above, fading with depth */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[70vh]"
          style={{ background: "radial-gradient(ellipse at 50% -10%, rgba(255,255,255,0.22), transparent 60%)" }}
        />

        {/* deck bar: a dark raft right under the surface */}
        <div className="relative z-20" style={{ background: surfaceWater }}>
          <div className="mx-auto max-w-[1400px] px-6 pt-6 sm:px-12">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border border-white/10 px-5 py-3 font-mono text-[11px] tracking-[0.16em] text-white/60 uppercase" style={{ background: DECK }}>
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {stagesPresent.map((st) => (
                  <span key={st} className="flex items-center gap-2">
                    <span aria-hidden className="inline-block h-2 w-2" style={{ background: STAGE[st].color }} />
                    {STAGE[st].label}
                  </span>
                ))}
              </span>
              <span className="text-white/40">{meta ?? <>Generated by {roadmap.generated_by}</>}</span>
              {actions && <span className="ml-auto flex flex-wrap items-center gap-3 normal-case tracking-normal">{actions}</span>}
            </div>
          </div>
        </div>

        {layers.map((layer, i) => {
          const top = marks[i + 1];
          const bottom = marks[i + 2] ?? MAX_METERS;
          const cols = Math.min(3, layer.length);
          const width = cols === 1 ? "md:max-w-xl" : cols === 2 ? "md:max-w-4xl" : "";
          return (
            <section key={i} className="relative" style={{ background: `linear-gradient(180deg, ${water(top)} 0%, ${water(bottom)} 100%)` }}>
              <div className="mx-auto max-w-[1400px] px-6 py-12 sm:px-12 lg:py-16">
                <DepthMark meters={top} />
                <div
                  className={`relative z-20 mx-auto mt-6 grid gap-6 md:grid-cols-[repeat(var(--cols),minmax(0,1fr))] ${width}`}
                  style={{ "--cols": cols } as React.CSSProperties}
                >
                  {layer.map((s) => (
                    <StepCard key={s.id} ref={register(s.id)} step={s} note={notes.get(s.id)} />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* ---- Ocean floor --------------------------------------------------- */}
      <section className="relative" style={{ background: floorColor }}>
        <Seafloor />
        <div className="relative z-10 mx-auto max-w-[1400px] px-6 pt-10 pb-44 sm:px-12">
          <DepthMark meters={MAX_METERS} />
          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <h2 className="text-3xl leading-[1.05] font-semibold sm:text-5xl">
              You&apos;ve reached the bottom.{" "}
              <em className="font-light">
                <NeonGlow colors="#67e8f9" glowIntensity="normal" className="not-italic">
                  Here&apos;s your first move.
                </NeonGlow>
              </em>
            </h2>
            <div className="border border-white/10 px-6 py-6" style={{ background: DECK, boxShadow: "inset 3px 0 0 #67e8f9" }}>
              <div className="font-mono text-[10px] tracking-[0.18em] text-white/45 uppercase">
                First move{roadmap.explanation ? ` · ${roadmap.explanation.generated_by}` : ""}
              </div>
              <p className="mt-3 text-lg leading-relaxed text-white/85">
                {roadmap.explanation?.first_move ??
                  "Meet with an MDC advisor this week to confirm the program and map your first semester."}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/majors"
                  className="bg-white px-5 py-2.5 font-mono text-xs tracking-[0.16em] text-[#040b16] uppercase transition hover:bg-slate-200"
                >
                  Browse all majors
                </Link>
                <Link
                  href="/dive"
                  className="border border-white/30 px-5 py-2.5 font-mono text-xs tracking-[0.16em] text-white uppercase transition hover:bg-white/10"
                >
                  Retake the dive ↑
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/** The surface and a "charting" line, shown while a roadmap streams in. */
export function RoadmapLoading({ eyebrow }: { eyebrow: string }) {
  return (
    <div className="relative min-h-screen text-white" style={{ background: water(MAX_METERS) }}>
      <section className="relative text-slate-900" style={{ background: `linear-gradient(180deg, ${SKY_TOP} 0%, ${SKY_BOTTOM} 100%)` }}>
        <div className="mx-auto max-w-[1400px] px-6 pt-24 pb-28 sm:px-12 lg:pt-28 lg:pb-32">
          <div className="font-mono text-[11px] tracking-[0.18em] text-slate-700 uppercase">{eyebrow}</div>
          <p className="mt-5 text-2xl text-slate-700">Charting your dive…</p>
        </div>
        <Waterline color={water(200)} />
      </section>
    </div>
  );
}

function DepthMark({ meters }: { meters: number }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[10px] tracking-[0.18em] text-white/55 uppercase">
      <span aria-hidden className="h-px w-10 bg-white/35" />
      <span>
        {fmt.format(meters)} m · {zoneAt(meters).name}
      </span>
    </div>
  );
}

type CardProps = { step: RoadmapStep; note?: string; ref: (el: HTMLElement | null) => void };

function StepCard({ step, note, ref }: CardProps) {
  const { label, color } = STAGE[step.stage];
  const courses = step.courses ?? [];
  return (
    <article
      ref={ref}
      className="relative flex flex-col border border-white/10 px-6 py-5"
      style={{ background: DECK, boxShadow: `inset 3px 0 0 ${color}` }}
    >
      <div className="flex items-baseline justify-between gap-4 font-mono text-[10px] tracking-[0.18em] uppercase">
        <span style={{ color }}>{label}</span>
        <span className="text-right text-white/40">{step.duration}</span>
      </div>
      <h3 className="mt-2 text-xl leading-tight font-semibold sm:text-2xl">{step.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/65">{step.detail}</p>
      {note && <p className="mt-3 border-t border-white/10 pt-3 text-sm leading-relaxed text-white/50">{note}</p>}
      {courses.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5 font-mono text-[10px] tracking-[0.08em]">
          {courses.map((c) => (
            <li key={c.code} title={`${c.title} · ${c.credits} cr${c.note ? ` · ${c.note}` : ""}`} className="border border-white/15 px-1.5 py-0.5 text-white/70">
              {c.code}
            </li>
          ))}
        </ul>
      )}
      {step.source_url && (
        <a
          href={step.source_url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 self-start font-mono text-[10px] tracking-[0.16em] text-white/40 uppercase transition hover:text-white"
        >
          Source ↗
        </a>
      )}
    </article>
  );
}

/** Wave edge at the bottom of the hero: water-coloured crests with a foam line, drifting slowly. */
function Waterline({ color }: { color: string }) {
  const crest =
    "M0 36 C 90 20, 180 20, 270 36 S 450 52, 540 36 S 720 20, 810 36 S 990 52, 1080 36 S 1260 20, 1350 36 S 1530 52, 1620 36 S 1800 20, 1890 36 S 2070 52, 2160 36";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-16 overflow-hidden">
      <svg className="waterline absolute bottom-0 left-0 h-full w-[200%]" viewBox="0 0 2160 64" preserveAspectRatio="none">
        <path d={`${crest} V64 H0 Z`} fill={color} />
        <path d={crest} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

/** Dunes, kelp and a few glowing anemones: a still version of the dive's seafloor. */
function Seafloor() {
  const anemones = [120, 310, 520, 760, 980, 1180, 1340];
  return (
    <svg aria-hidden className="absolute inset-x-0 bottom-0 h-[220px] w-full" viewBox="0 0 1440 220" preserveAspectRatio="none">
      <defs>
        <radialGradient id="anemone">
          <stop offset="0%" stopColor="#5eead4" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#5eead4" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* kelp behind the far dune */}
      {[200, 240, 640, 690, 1100, 1150].map((x, i) => (
        <path
          key={x}
          d={`M${x} 220 C ${x + 12} 180, ${x - 14} 150, ${x + 6} ${110 - (i % 3) * 18}`}
          fill="none"
          stroke="#0d2b25"
          strokeWidth={4}
          strokeLinecap="round"
        />
      ))}
      <path d="M0 150 C 180 120, 300 170, 480 140 S 820 110, 1000 150 S 1300 130, 1440 145 V220 H0 Z" fill="#0a1d22" />
      <path d="M0 185 C 160 160, 340 200, 520 178 S 860 150, 1040 185 S 1320 170, 1440 190 V220 H0 Z" fill="#0f2622" />
      {anemones.map((x, i) => {
        const y = 176 + (i % 2) * 8;
        return (
          <g key={x}>
            <circle cx={x} cy={y} r={14} fill="url(#anemone)" opacity={0.55} />
            <circle cx={x} cy={y} r={2.2} fill="#99f6e4" />
          </g>
        );
      })}
    </svg>
  );
}
