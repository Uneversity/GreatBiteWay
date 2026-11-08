"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, animate, useMotionValue, useReducedMotion } from "motion/react";
import { api, type Answer, type Question, type QuizStep } from "@/lib/api";
import { holdBoot } from "@/lib/boot";
import { checkpointMeters } from "@/lib/depth";
import { OceanBackdrop } from "./OceanBackdrop";
import { OceanCanvas } from "./OceanCanvas";
import { OceanSurface } from "./OceanSurface";
import { OceanDeep } from "./OceanDeep";
import { DepthGauge } from "./DepthGauge";
import { EntryCover } from "./EntryCover";
import { SharkSwim } from "./SharkSwim";
import { SurfaceHero } from "./SurfaceHero";
import { Checkpoint } from "./Checkpoint";
import { FloorResult } from "./FloorResult";

/**
 * The dive as a locked sequence rather than a scrolling page.
 *
 * Stages: 0 = surface, 1..N = checkpoints, N+1 = ocean floor. There is no
 * document scroll; the only way down is answering and pressing Descend. Between
 * stages the current view leaves, the depth value is animated over a few seconds
 * (which drives the canvas, the rail and the shark), and the next view arrives
 * part-way through the descent.
 */
export function DiveExperience() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  // results[i] = backend scoring after answering questions[0..i]; results[-1] = baseline.
  const [results, setResults] = useState<Record<number, QuizStep>>({});
  const [stage, setStage] = useState(0);
  const [phase, setPhase] = useState<"idle" | "travelling">("idle");
  const [error, setError] = useState<string | null>(null);
  const [webgl, setWebgl] = useState(true); // 2D canvas is only the fallback
  const busy = useRef(false);
  const timers = useRef<number[]>([]);
  const reduced = useReducedMotion();

  useEffect(() => {
    // Keep the startup splash up until the quiz can actually be used.
    const release = holdBoot();
    Promise.all([
      api.quizQuestions().then(setQuestions).catch((e) => setError(String(e))),
      api.quizStep([]).then((r) => setResults((prev) => ({ ...prev, [-1]: r }))).catch((e) => setError(String(e))),
    ]).finally(release);
    const pending = timers.current;
    return () => {
      release();
      pending.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const expected = questions.length || 5;
  const marks = useMemo(() => checkpointMeters(expected + 2), [expected]);
  const meters = useMotionValue(0);
  // Where the waterline sits on the hero (screen fraction from the top), measured
  // from the hero's buttons so the water starts right underneath them.
  const surface = useMotionValue(0.62);
  const [surfaceLine, setSurfaceLine] = useState(0.62);
  const onSurfaceLine = useCallback(
    (fraction: number) => {
      surface.set(fraction);
      setSurfaceLine(fraction);
    },
    [surface],
  );

  const floor = questions.length + 1;
  // Scoring for the floor view, from whatever has been answered when you get there.
  const [floorResult, setFloorResult] = useState<QuizStep | null>(null);

  /** Travel to a stage: view out → depth animates → view in. */
  const travel = useCallback(
    (to: number) => {
      if (busy.current) return;
      busy.current = true;
      const descending = to > stage;
      // Trips all the way to the surface or the floor take the long, slow dive; stage to stage is quicker.
      const long = to === 0 || to === floor;
      const duration = reduced ? 0.6 : long ? (descending ? 3.6 : 2.6) : descending ? 2.9 : 2.1;
      const arriveAt = reduced ? 250 : long ? (descending ? 2300 : 1500) : descending ? 1800 : 1200;

      if (to === floor && questions.length > 0) {
        setFloorResult(null);
        const list: Answer[] = questions
          .filter((q) => answers[q.id] !== undefined)
          .map((q) => ({ question_id: q.id, value: answers[q.id] }));
        api
          .quizStep(list)
          .then(setFloorResult)
          .catch((e) => setError(String(e)));
      }

      setPhase("travelling");
      setStage(to);
      animate(meters, marks[to], { duration, ease: [0.42, 0, 0.18, 1] });
      timers.current.push(
        window.setTimeout(() => setPhase("idle"), arriveAt),
        window.setTimeout(() => {
          busy.current = false;
        }, duration * 1000 + 100),
      );
    },
    [stage, marks, meters, reduced, floor, questions, answers],
  );

  const select = useCallback(
    (qIndex: number, value: number) => {
      const next = { ...answers, [questions[qIndex].id]: value };
      setAnswers(next);
      const list: Answer[] = questions
        .slice(0, qIndex + 1)
        .filter((q) => next[q.id] !== undefined)
        .map((q) => ({ question_id: q.id, value: next[q.id] }));
      api
        .quizStep(list)
        .then((r) => setResults((prev) => ({ ...prev, [qIndex]: r })))
        .catch((e) => setError(String(e)));
    },
    [answers, questions],
  );

  const retake = useCallback(() => {
    setAnswers({});
    setResults((prev) => ({ [-1]: prev[-1] }));
    setFloorResult(null);
    travel(0);
  }, [travel]);

  const qIndex = stage - 1; // which question the current stage shows
  const question = questions[qIndex];
  const answeredCount = questions.filter((q) => answers[q.id] !== undefined).length;
  const finalResult = floorResult ?? results[questions.length - 1] ?? results[-1];
  const inRange = (results[qIndex - 1] ?? results[-1])?.in_range ?? [];

  // Free movement: up any time, down once the current question is answered.
  const idle = phase === "idle";
  const canAscend = idle && stage >= 1;
  const canDescend = idle && (stage === 0 || (question !== undefined && answers[question.id] !== undefined));
  // Jumping straight to a stage from the depth gauge: anywhere above, the floor from anywhere,
  // or a deeper question once every question on the way is answered.
  const canJumpTo = useCallback(
    (to: number) => {
      if (!idle || to === stage || to < 0 || to > floor || questions.length === 0) return false;
      if (to < stage || to === floor) return true;
      return questions.slice(0, to - 1).every((q) => answers[q.id] !== undefined);
    },
    [idle, stage, floor, questions, answers],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select")) return;
      if (e.key === "ArrowDown" && canDescend) {
        e.preventDefault();
        travel(stage + 1);
      } else if (e.key === "ArrowUp" && canAscend) {
        e.preventDefault();
        travel(stage - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canAscend, canDescend, stage, travel]);

  return (
    <div className="fixed inset-0 overflow-hidden">
      <OceanBackdrop meters={meters} surface={surface} />
      {!webgl && <OceanCanvas meters={meters} />}
      <OceanDeep meters={meters} onSupport={setWebgl} />
      <OceanSurface meters={meters} surface={surface} />
      <DepthGauge meters={meters} marks={marks} activeIndex={stage} armed={stage >= 1} onSelect={travel} canSelect={canJumpTo} />
      <SharkSwim section={stage} meters={meters} surface={surfaceLine} />
      <EntryCover ready={questions.length > 0 || error !== null} />

      {error && (
        <div className="fixed bottom-4 left-4 z-40 bg-red-700 px-3 py-2 font-mono text-xs text-white">Backend error: {error}</div>
      )}

      {/* Travel controls: hang off the header once the dive has started */}
      {stage >= 1 && (
        <nav
          aria-label="Dive navigation"
          className="fixed top-14 left-0 z-40 flex items-center border-r border-b border-white/10 bg-[#040b16] font-mono text-[11px] tracking-[0.16em] text-white/60 uppercase"
        >
          <button type="button" disabled={!canAscend} onClick={() => travel(stage - 1)} className="px-3 py-2 transition-colors hover:text-white disabled:text-white/25">
            ↑ ascend
          </button>
          <button type="button" disabled={!canDescend} onClick={() => travel(stage + 1)} className="border-l border-white/10 px-3 py-2 transition-colors hover:text-white disabled:text-white/25">
            ↓ descend
          </button>
          <button type="button" disabled={!idle} onClick={() => travel(0)} className="border-l border-white/10 px-3 py-2 transition-colors hover:text-white disabled:text-white/25">
            ⇈ surface
          </button>
          <button type="button" disabled={!canJumpTo(floor)} onClick={() => travel(floor)} className="border-l border-white/10 px-3 py-2 transition-colors hover:text-white disabled:text-white/25">
            ⇊ floor
          </button>
        </nav>
      )}

      <main className="absolute inset-0 pt-14 pr-[76px] sm:pr-[104px] lg:pr-[150px]">
        {/* initial={false}: the hero is in the first HTML at full opacity instead of fading in after JS loads. */}
        <AnimatePresence mode="wait" initial={false}>
          {phase === "idle" && stage === 0 && (
            <SurfaceHero key="surface" checkpoints={expected} onStart={() => travel(1)} onSurfaceLine={onSurfaceLine} />
          )}

          {phase === "idle" && question && (
            <Checkpoint
              key={question.id}
              index={qIndex + 1}
              total={questions.length}
              question={question}
              meters={marks[stage]}
              selected={answers[question.id]}
              inRange={inRange.map((f) => f.name)}
              isLast={qIndex === questions.length - 1}
              onSelect={(v) => select(qIndex, v)}
              onContinue={() => travel(stage + 1)}
            />
          )}

          {phase === "idle" && questions.length > 0 && stage === floor && (
            <FloorResult
              key="floor"
              matches={finalResult?.top_matches ?? []}
              inRange={finalResult?.in_range ?? []}
              answered={answeredCount}
              total={questions.length}
              onRetake={retake}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
