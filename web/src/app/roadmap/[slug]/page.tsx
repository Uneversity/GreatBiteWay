import { Suspense } from "react";
import { RoadmapDescent, RoadmapLoading } from "@/components/roadmap/RoadmapDescent";
import { SaveRoadmapButton } from "@/components/SaveRoadmapButton";
import { api } from "@/lib/api";
import { auth0 } from "@/lib/auth0";

const EYEBROW = "Your pathway";

async function RoadmapContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [roadmap, session] = await Promise.all([api.roadmap(slug), auth0 ? auth0.getSession() : null]);
  return (
    <RoadmapDescent
      roadmap={roadmap}
      eyebrow={EYEBROW}
      actions={auth0 ? <SaveRoadmapButton slug={slug} signedIn={Boolean(session)} /> : null}
    />
  );
}

export default function RoadmapPage({ params }: PageProps<"/roadmap/[slug]">) {
  return (
    <main>
      <Suspense fallback={<RoadmapLoading eyebrow={EYEBROW} />}>
        <RoadmapContent params={params} />
      </Suspense>
    </main>
  );
}
