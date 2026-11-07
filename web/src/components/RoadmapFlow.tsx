"use client";

import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { RoadmapStep } from "@/lib/api";

const STAGE_COLOR: Record<RoadmapStep["stage"], string> = {
  mdc: "#0ea5e9",
  transfer: "#6366f1",
  certification: "#f59e0b",
  career: "#10b981",
};

/** Renders roadmap steps top-to-bottom like a dive. */
export function RoadmapFlow({ steps }: { steps: RoadmapStep[] }) {
  const nodes: Node[] = steps.map((s, i) => ({
    id: s.id,
    position: { x: (i % 2) * 260, y: i * 130 },
    data: {
      label: (
        <div className="text-left">
          <div className="text-[10px] uppercase tracking-wide opacity-70">
            {s.stage} · {s.duration}
          </div>
          <div className="font-semibold">{s.title}</div>
          <div className="text-xs opacity-80">{s.detail}</div>
        </div>
      ),
    },
    style: { borderColor: STAGE_COLOR[s.stage], borderWidth: 2, width: 240 },
  }));

  const edges: Edge[] = steps.flatMap((s) =>
    s.depends_on.map((dep) => ({ id: `${dep}-${s.id}`, source: dep, target: s.id, animated: true })),
  );

  return (
    <div className="h-[70vh] w-full rounded-xl bg-white text-slate-900">
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
