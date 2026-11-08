import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Ocean } from "@/components/Ocean";
import { SavedRoadmapView } from "@/components/SavedRoadmapView";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <SavedRoadmapView id={Number(id)} />;
}

export default function SavedRoadmapPage({ params }: PageProps<"/account/roadmaps/[id]">) {
  return (
    <Ocean depth={0.7}>
      <main className="mx-auto max-w-6xl px-6 pt-24 pb-16">
        <p className="text-sm uppercase tracking-wide opacity-70">Saved pathway</p>
        <Suspense fallback={<p className="mt-2 opacity-70">Charting your dive…</p>}>
          <Content params={params} />
        </Suspense>
      </main>
    </Ocean>
  );
}
