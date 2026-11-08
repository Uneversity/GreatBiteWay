import type { RoadmapStep } from "@/lib/api";

/**
 * Groups steps into layers for a top-to-bottom flowchart: a step sits one layer
 * below the deepest step it depends on. Steps with no dependencies form layer 0.
 * Unknown dependencies are ignored and cycles are cut, so bad data still renders.
 */
export function layerSteps(steps: RoadmapStep[]): RoadmapStep[][] {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const depth = new Map<string, number>();
  const visiting = new Set<string>();

  const visit = (id: string): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    const step = byId.get(id);
    if (!step || visiting.has(id)) return -1;
    visiting.add(id);
    let d = 0;
    for (const dep of step.depends_on) d = Math.max(d, visit(dep) + 1);
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };

  const layers: RoadmapStep[][] = [];
  for (const s of steps) {
    const d = Math.max(0, visit(s.id));
    (layers[d] ??= []).push(s);
  }
  return layers.filter((l) => l && l.length > 0);
}
