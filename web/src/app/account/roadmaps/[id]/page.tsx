import { Suspense } from "react";
import { notFound } from "next/navigation";
import { RoadmapLoading } from "@/components/roadmap/RoadmapDescent";
import { SavedRoadmapView } from "@/components/SavedRoadmapView";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <SavedRoadmapView id={Number(id)} />;
}

export default function SavedRoadmapPage({ params }: PageProps<"/account/roadmaps/[id]">) {
  return (
    <main>
      <Suspense fallback={<RoadmapLoading eyebrow="Saved pathway" />}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}
