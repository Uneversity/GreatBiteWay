"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Ocean } from "@/components/Ocean";
import { Shark } from "@/components/Shark";
import { DepthMeter } from "@/components/DepthMeter";
import { api, type Answer, type QuizStep } from "@/lib/api";

export default function DivePage() {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [step, setStep] = useState<QuizStep | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Each answer goes to the backend, which returns the next question and the new depth.
  useEffect(() => {
    api
      .quizStep(answers)
      .then(setStep)
      .catch((e) => setError(String(e)));
  }, [answers]);

  const depth = step?.depth ?? 0;
  const question = step && !step.done ? step.next_question : null;
  const best = step?.done ? step.top_matches[0] : undefined;

  return (
    <Ocean depth={depth}>
      <div className="mx-auto flex min-h-screen max-w-5xl items-center gap-8 px-6 pt-20 pb-32">
        <DepthMeter depth={depth} />

        <div className="relative flex-1">
          {/* The shark sinks as the backend narrows down the candidate fields */}
          <motion.div
            className="pointer-events-none absolute -left-4 w-32"
            initial={{ top: 0 }}
            animate={{ top: `${depth * 60}vh` }}
            transition={{ type: "spring", stiffness: 40, damping: 14 }}
          >
            <Shark />
          </motion.div>

          <div className="ml-40 max-w-xl space-y-6">
            {error && <p className="rounded bg-red-500/80 p-3 text-sm">Backend error: {error}</p>}

            {question && (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-white/10 p-6 backdrop-blur"
              >
                <h2 className="mb-4 text-2xl font-semibold">{question.text}</h2>
                <div className="grid gap-2">
                  {question.options.map((o) => (
                    <button
                      key={o.label}
                      onClick={() => setAnswers((a) => [...a, { question_id: question.id, value: o.value }])}
                      className="rounded-lg bg-white/15 px-4 py-2 text-left hover:bg-white/30"
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {best && (
              <div className="rounded-2xl bg-white/10 p-6 backdrop-blur">
                <p className="text-sm uppercase tracking-wide opacity-70">You reached the ocean floor</p>
                <h2 className="mt-1 text-3xl font-bold">{best.name}</h2>
                <Link
                  href={`/roadmap/${best.slug}`}
                  className="mt-4 inline-block rounded-full bg-white px-5 py-2 font-semibold text-sky-900"
                >
                  See my roadmap
                </Link>
              </div>
            )}

            {step && step.top_matches.length > 0 && (
              <ul className="space-y-1 text-sm opacity-80">
                {step.top_matches.map((m) => (
                  <li key={m.slug}>
                    {m.name}: {(m.score * 100).toFixed(0)}%
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Ocean>
  );
}
