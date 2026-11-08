"use client";

import { useEffect, useRef, useState } from "react";
import { MdcMark } from "@/components/MdcMark";
import { MdcSpinner } from "@/components/MdcSpinner";
import { api, type Roadmap, type RoadmapStep, type StepElaboration, type StepFact } from "@/lib/api";

type Props = {
  roadmap: Roadmap;
  /** The open step, or null when the panel is closed. */
  step: RoadmapStep | null;
  stage: { label: string; color: string } | null;
  onClose: () => void;
};

/** No entry for a step means it's loading. */
type Entry = { status: "ready"; data: StepElaboration } | { status: "error"; message: string };

const DECK = "#040b16";

/**
 * Side panel that slides in from the right when a step is clicked and asks
 * Gemini for a closer look at it. Answers are kept per step for the life of the
 * page, so going back to a step you already opened is instant.
 */
export function StepPanel({ roadmap, step, stage, onClose }: Props) {
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const closeBtn = useRef<HTMLButtonElement>(null);
  const open = step !== null;
  const stepId = step?.id ?? null;
  const entry = stepId ? entries[stepId] : undefined;
  const needsFetch = stepId !== null && entry === undefined;

  // Fetch the elaboration for the open step unless we already have it (or its error).
  useEffect(() => {
    if (!needsFetch || !stepId) return;
    const ctrl = new AbortController();
    api
      .elaborate(roadmap, stepId, ctrl.signal)
      .then((data) => setEntries((e) => ({ ...e, [stepId]: { status: "ready", data } })))
      .catch((err) => {
        if (ctrl.signal.aborted) return; // switched steps or closed: it'll refetch if reopened
        const message = String(err).startsWith("Error: 503")
          ? "The AI advisor isn't available right now. Try again in a moment."
          : "Couldn't load more about this step.";
        setEntries((e) => ({ ...e, [stepId]: { status: "error", message } }));
      });
    return () => ctrl.abort();
  }, [needsFetch, stepId, roadmap]);

  const retry = () => {
    if (!stepId) return;
    setEntries((e) => {
      const rest = { ...e };
      delete rest[stepId];
      return rest;
    });
  };

  // Esc closes; focus moves into the panel when it opens.
  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step?.id, onClose]);

  const color = stage?.color ?? "#67e8f9";

  return (
    <>
      {/* dim the page on small screens, where the panel covers it */}
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 top-14 z-40 bg-[#020617]/60 transition-opacity duration-300 lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        role="dialog"
        aria-modal="false"
        aria-label={step ? `More about ${step.title}` : "Step details"}
        aria-hidden={!open}
        inert={!open}
        className={`fixed top-14 right-0 bottom-0 z-50 flex w-full flex-col border-l border-white/10 text-white shadow-[-24px_0_48px_rgba(2,6,23,0.45)] transition-transform duration-300 ease-out sm:w-[440px] ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ background: DECK }}
      >
        {step && (
          <>
            <header className="border-b border-white/10 px-6 pt-5 pb-4" style={{ boxShadow: `inset 3px 0 0 ${color}` }}>
              <div className="flex items-center justify-between gap-4 font-mono text-[10px] tracking-[0.18em] uppercase">
                <span style={{ color }}>
                  {stage?.label} · {step.duration}
                </span>
                <button
                  ref={closeBtn}
                  type="button"
                  onClick={onClose}
                  className="shrink-0 px-1 whitespace-nowrap text-white/50 transition-colors hover:text-white"
                  aria-label="Close"
                >
                  Close ✕
                </button>
              </div>
              <h2 className="mt-2 text-2xl leading-tight font-semibold">{step.title}</h2>
              {entry?.status === "ready" && entry.data.headline && (
                <p className="mt-1 text-white/60 italic">{entry.data.headline}</p>
              )}
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-5" aria-live="polite" aria-busy={!entry}>
              {!entry && <Loading color={color} />}
              {entry?.status === "error" && (
                <div>
                  <p className="text-white/70">{entry.message}</p>
                  <button
                    type="button"
                    onClick={retry}
                    className="mt-4 border border-white/30 px-4 py-2 font-mono text-[11px] tracking-[0.16em] uppercase transition hover:bg-white/10"
                  >
                    Try again
                  </button>
                </div>
              )}
              {entry?.status === "ready" && <Body data={entry.data} step={step} color={color} />}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

/** "MDC AI" at work: the spinning mark in the step's colour while Gemini writes. */
function Loading({ color }: { color: string }) {
  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <MdcSpinner
        label="MDC AI is looking into this step"
        size="h-14"
        className=""
        caption={
          <div className="flex flex-col items-center gap-1.5">
            <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.22em] uppercase">
              <span style={{ color }}>MDC</span>
              <span className="bg-white px-1.5 py-0.5 text-[10px] tracking-[0.16em] text-[#040b16]">AI</span>
            </span>
            <span className="font-mono text-[10px] tracking-[0.16em] text-white/45 uppercase">Looking into this step…</span>
          </div>
        }
      />
    </div>
  );
}

function Body({ data, step, color }: { data: StepElaboration; step: RoadmapStep; color: string }) {
  return (
    <div className="space-y-7">
      <p className="text-[17px] leading-relaxed text-white/85">{data.overview}</p>

      {(data.mdc_facts?.length ?? 0) > 0 && <MdcFacts facts={data.mdc_facts!} checkedOn={data.mdc_checked_on} />}

      {data.specs.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 border-y border-white/10 py-4 text-sm">
          {data.specs.map((f) => (
            <div key={f.label} className="contents">
              <dt className="font-mono text-[10px] tracking-[0.16em] text-white/45 uppercase">{f.label}</dt>
              <dd className="text-white/80">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <List title="What to expect" items={data.what_to_expect} color={color} />
      <List title="How to prepare" items={data.how_to_prepare} color={color} />
      <List title="Ask your MDC advisor" items={data.questions_to_ask} color={color} marker="?" />

      {data.leads_to && (
        <section>
          <h3 className="font-mono text-[10px] tracking-[0.18em] text-white/45 uppercase">Where it leads</h3>
          <p className="mt-2 text-white/75">{data.leads_to}</p>
        </section>
      )}

      {(step.courses?.length ?? 0) > 0 && (
        <section>
          <h3 className="font-mono text-[10px] tracking-[0.18em] text-white/45 uppercase">Courses in this step</h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {step.courses!.map((c) => (
              <li key={c.code} className="flex gap-3">
                <span className="w-20 shrink-0 font-mono text-[11px] text-white/60">{c.code}</span>
                <span className="text-white/80">
                  {c.title} <span className="text-white/40">· {c.credits} cr{c.note ? ` · ${c.note}` : ""}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 font-mono text-[10px] tracking-[0.16em] text-white/35 uppercase">
        <span>Written by {data.generated_by} · double-check with MDC</span>
        {step.source_url && (
          <a href={step.source_url} target="_blank" rel="noreferrer" className="text-white/50 transition hover:text-white">
            Source ↗
          </a>
        )}
      </footer>
    </div>
  );
}

const checkedFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Official facts copied from mdc.edu, each with a link to the page it came from. */
function MdcFacts({ facts, checkedOn }: { facts: StepFact[]; checkedOn?: string | null }) {
  const checked = checkedOn ? checkedFmt.format(new Date(`${checkedOn}T00:00:00Z`)) : null;
  return (
    <section className="border border-white/10 bg-white/[0.03] px-4 py-4" style={{ boxShadow: "inset 3px 0 0 #ffffff" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-[10px] tracking-[0.18em] uppercase">
        <h3 className="flex items-center gap-2 font-mono text-white/80">
          <MdcMark className="h-2.5 w-auto text-white" title="" />
          Official MDC info
        </h3>
        {checked && <span className="text-white/35">checked {checked}</span>}
      </div>
      <dl className="mt-3 space-y-2.5 text-sm">
        {facts.map((f, i) => (
          <div key={i} className="grid grid-cols-[6.5rem_1fr] gap-x-3">
            <dt className="pt-0.5 font-mono text-[10px] tracking-[0.14em] text-white/45 uppercase">{f.label}</dt>
            <dd className="text-white/85">
              {f.value}{" "}
              {f.source_url && (
                <a
                  href={f.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[10px] tracking-[0.1em] whitespace-nowrap text-white/40 uppercase transition hover:text-white"
                >
                  {sourceLabel(f.source_url)} ↗
                </a>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function sourceLabel(url: string) {
  try {
    const u = new URL(url);
    return u.pathname.endsWith(".pdf") ? `${u.hostname.replace(/^www\./, "")} PDF` : u.hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

function List({ title, items, color, marker = "—" }: { title: string; items: string[]; color: string; marker?: string }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="font-mono text-[10px] tracking-[0.18em] text-white/45 uppercase">{title}</h3>
      <ul className="mt-2 space-y-2">
        {items.map((it) => (
          <li key={it} className="flex gap-3 text-white/80">
            <span aria-hidden className="shrink-0 font-mono text-[11px] leading-6" style={{ color }}>
              {marker}
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
