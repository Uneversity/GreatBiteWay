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

export const api = {
  quizQuestions: () => request<Question[]>("/quiz/questions"),
  quizStep: (answers: Answer[]) =>
    request<QuizStep>("/quiz/step", { method: "POST", body: JSON.stringify({ answers }) }),
  majors: () => request<Major[]>("/majors"),
  roadmap: (slug: string) => request<Roadmap>(`/roadmap/${slug}`),
};
