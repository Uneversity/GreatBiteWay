// Typed client for the FastAPI backend.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Answer = { question_id: string; value: number };

export type Question = {
  id: string;
  text: string;
  options: { label: string; value: number }[];
};

export type FieldMatch = { slug: string; name: string; score: number };

export type QuizStep = {
  depth: number; // 0 = surface, 1 = ocean floor (field decided)
  done: boolean;
  next_question: Question | null;
  top_matches: FieldMatch[];
  in_range: FieldMatch[];
};

export type CareerHighlight = {
  title: string;
  median_pay: number;
  pay_year: number;
  outlook: string; // e.g. "6% (Faster than average)"
  outlook_period: string;
  source_url: string;
};

export type StudyHighlight = {
  path: string; // e.g. "A.S. then B.S."
  credits: number;
  years: number;
  est_cost: number; // in-state tuition + fees before aid
  source_url: string;
  cost_source_url: string;
};

export type Major = {
  slug: string;
  name: string;
  field: string;
  mdc_program: string;
  summary: string;
  mdc_url?: string | null;
  career?: CareerHighlight | null;
  study?: StudyHighlight | null;
};

export type CourseRef = {
  code: string;
  title: string;
  credits: number;
  note?: string | null;
  prepares_for?: string | null;
};

export type RoadmapStep = {
  id: string;
  stage: "mdc" | "transfer" | "career" | "certification";
  title: string;
  detail: string;
  duration: string;
  depends_on: string[];
  courses?: CourseRef[];
  source_url?: string | null;
};

export type RoadmapExplanation = {
  summary: string;
  step_notes: { id: string; note: string }[];
  first_move: string;
  generated_by: string;
};

export type Roadmap = {
  career: string;
  summary: string;
  steps: RoadmapStep[];
  generated_by: string;
  /** Plain-language notes from Gemini; older saved copies may not have it. */
  explanation?: RoadmapExplanation | null;
};

export type StepFact = { label: string; value: string; source_url?: string | null };

export type StepElaboration = {
  step_id: string;
  headline: string;
  overview: string;
  specs: StepFact[];
  what_to_expect: string[];
  how_to_prepare: string[];
  questions_to_ask: string[];
  leads_to: string;
  generated_by: string;
  /** Official MDC facts for this step (tuition, admission, program), each with its mdc.edu source. */
  mdc_facts?: StepFact[];
  mdc_checked_on?: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export type SavedRoadmapSummary = {
  id: number;
  major_slug: string;
  major_name: string;
  created_at: string;
  updated_at: string;
};

export type SavedRoadmap = SavedRoadmapSummary & { roadmap: Roadmap };

export type QuizResult = {
  id: number;
  answers: Answer[];
  top_matches: FieldMatch[];
  depth: number;
  done: boolean;
  created_at: string;
};

export type Me = { user_id: string; saved_roadmaps: number; quiz_results: number };

/** Same-origin call to a Next.js route under /api/me, which adds the Auth0 token server-side. */
async function account<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/me${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new AccountError(res.status, await res.text());
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** `status` 401 means signed out (send them to /auth/login); 503 means sign-in isn't configured. */
export class AccountError extends Error {
  constructor(public status: number, body: string) {
    super(`${status} ${body}`);
  }
}

/** Full-page trip to Auth0 sign-in and back to `returnTo`. */
export function goToLogin(returnTo: string) {
  // /auth/* is served by the Auth0 proxy, not a Next.js page, so it needs a real navigation, not router.push.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}

/** Signed-in features. Call from client components only (they rely on the session cookie). */
export const me = {
  profile: () => account<Me>(""),
  roadmaps: () => account<SavedRoadmapSummary[]>("/roadmaps"),
  roadmap: (id: number) => account<SavedRoadmap>(`/roadmaps/${id}`),
  saveRoadmap: (majorSlug: string) =>
    account<SavedRoadmap>("/roadmaps", { method: "POST", body: JSON.stringify({ major_slug: majorSlug }) }),
  deleteRoadmap: (id: number) => account<void>(`/roadmaps/${id}`, { method: "DELETE" }),
  quizResults: () => account<QuizResult[]>("/quiz-results"),
  saveQuizResult: (answers: Answer[]) =>
    account<QuizResult>("/quiz-results", { method: "POST", body: JSON.stringify({ answers }) }),
};

export const api = {
  quizQuestions: () => request<Question[]>("/quiz/questions"),
  quizStep: (answers: Answer[]) =>
    request<QuizStep>("/quiz/step", { method: "POST", body: JSON.stringify({ answers }) }),
  majors: () => request<Major[]>("/majors"),
  roadmap: (slug: string) => request<Roadmap>(`/roadmap/${slug}`),
  /** Gemini's closer look at one step. Throws on 503 (no Gemini key) or 404 (step not in roadmap). */
  elaborate: (roadmap: Roadmap, stepId: string, signal?: AbortSignal, majorSlug?: string) =>
    request<StepElaboration>("/roadmap/elaborate", {
      method: "POST",
      body: JSON.stringify({ roadmap, step_id: stepId, major_slug: majorSlug ?? null }),
      signal,
    }),
};
