import { forwardAsUser } from "@/lib/backend";

/** The signed-in student's recent dives, newest first. */
export async function GET() {
  return forwardAsUser("/me/quiz-results");
}

/** Save a dive: body `{ "answers": [{ "question_id": "q_math", "value": 0 }, ...] }`. */
export async function POST(request: Request) {
  return forwardAsUser("/me/quiz-results", { method: "POST", body: await request.text() });
}
