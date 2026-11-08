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

export type Major = {
  slug: string;
  name: string;
  field: string;
  mdc_program: string;
  summary: string;
};

export type RoadmapStep = {
  id: string;
  stage: "mdc" | "transfer" | "career" | "certification";
  title: string;
  detail: string;
  duration: string;
  depends_on: string[];
};

export type Roadmap = {
  career: string;
  summary: string;
  steps: RoadmapStep[];
  generated_by: string;
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
};
