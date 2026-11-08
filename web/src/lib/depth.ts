/**
 * Shared depth model for the dive.
 *
 * The page is a stack of full-height sections (surface, one per checkpoint, floor).
 * Scroll progress maps onto a *non-linear* metre scale so early checkpoints sit in
 * the bright shallows and the later ones fall away fast into the dark — the same
 * way real ocean zones are distributed.
 */

export const MAX_METERS = 4000;

/** Metre marks for each section, in order. Index 0 = surface hero, last = floor. */
export function checkpointMeters(sectionCount: number): number[] {
  // Fixed anchors for the canonical 7-section layout; interpolate for other counts.
  const anchors = [0, 40, 200, 600, 1200, 2500, MAX_METERS];
  if (sectionCount === anchors.length) return anchors;
  return Array.from({ length: sectionCount }, (_, i) => {
    const t = (i / (sectionCount - 1)) * (anchors.length - 1);
    const a = Math.floor(t);
    const b = Math.min(anchors.length - 1, a + 1);
    return Math.round(lerp(anchors[a], anchors[b], t - a));
  });
}

export type Zone = { name: string; from: number; to: number };

export const ZONES: Zone[] = [
  { name: "Sunlight zone", from: 0, to: 200 },
  { name: "Twilight zone", from: 200, to: 1000 },
  { name: "Midnight zone", from: 1000, to: 2500 },
  { name: "Abyss", from: 2500, to: 3900 },
  { name: "Ocean floor", from: 3900, to: MAX_METERS },
];

export function zoneAt(m: number): Zone {
  return ZONES.find((z) => m < z.to) ?? ZONES[ZONES.length - 1];
}

/** Water colour at a given depth. Pale surface → near-black floor. */
const COLOR_STOPS: [number, [number, number, number]][] = [
  [0, [214, 240, 246]],
  [40, [96, 190, 205]],
  [200, [36, 132, 165]],
  [600, [24, 92, 140]],
  [1200, [21, 69, 111]],
  [2500, [11, 37, 65]],
  [MAX_METERS, [4, 13, 26]],
];

export function colorAt(m: number): [number, number, number] {
  const d = clamp(m, 0, MAX_METERS);
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const [m0, c0] = COLOR_STOPS[i];
    const [m1, c1] = COLOR_STOPS[i + 1];
    if (d <= m1) {
      const t = (d - m0) / (m1 - m0);
      return [lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t)];
    }
  }
  return COLOR_STOPS[COLOR_STOPS.length - 1][1];
}

export function rgb(c: [number, number, number], a = 1): string {
  return `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a})`;
}

/** Accent colour for glows: sky-blue in the shallows, cold cyan in the deep. */
export function accentAt(m: number): string {
  const t = clamp(m / MAX_METERS, 0, 1);
  const c: [number, number, number] = [lerp(14, 103, t), lerp(165, 232, t), lerp(233, 249, t)];
  return rgb(c);
}

/** 0..1 position of a depth on the (non-linear) gauge rail. */
export function railPosition(m: number, marks: number[]): number {
  const d = clamp(m, 0, MAX_METERS);
  for (let i = 0; i < marks.length - 1; i++) {
    if (d <= marks[i + 1]) {
      const t = (d - marks[i]) / (marks[i + 1] - marks[i] || 1);
      return (i + t) / (marks.length - 1);
    }
  }
  return 1;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Smooth 0→1 ramp between two depths. */
export function ramp(m: number, from: number, to: number): number {
  const t = clamp((m - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
}
