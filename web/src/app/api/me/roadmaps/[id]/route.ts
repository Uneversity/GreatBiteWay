import { forwardAsUser } from "@/lib/backend";

type Context = { params: Promise<{ id: string }> };

function badId() {
  return Response.json({ detail: "Roadmap id must be a number" }, { status: 400 });
}

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  return /^\d+$/.test(id) ? forwardAsUser(`/me/roadmaps/${id}`) : badId();
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  return /^\d+$/.test(id) ? forwardAsUser(`/me/roadmaps/${id}`, { method: "DELETE" }) : badId();
}
