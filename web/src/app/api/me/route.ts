import { forwardAsUser } from "@/lib/backend";

/** `{ user_id, saved_roadmaps, quiz_results }` for the signed-in student; 401 when signed out. */
export async function GET() {
  return forwardAsUser("/me");
}
