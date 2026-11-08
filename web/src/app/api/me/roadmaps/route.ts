import { forwardAsUser } from "@/lib/backend";

/** The signed-in student's saved roadmaps. */
export async function GET() {
  return forwardAsUser("/me/roadmaps");
}

/** Save (or refresh) a roadmap: body `{ "major_slug": "cybersecurity" }`. */
export async function POST(request: Request) {
  return forwardAsUser("/me/roadmaps", { method: "POST", body: await request.text() });
}
