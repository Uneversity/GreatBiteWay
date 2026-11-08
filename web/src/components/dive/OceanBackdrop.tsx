"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import { clamp, colorAt, ramp, rgb } from "@/lib/depth";

/**
 * Plain-CSS stand-in for the WebGL ocean, shown from the very first paint.
 *
 * At the surface it's sky over water, split at the same waterline the shader
 * uses; below the surface it's the depth colour. The WebGL canvases fade in on
 * top once their shaders have compiled, so the page never sits blank or dark
 * while the GPU is busy, and it's also what you see if WebGL never arrives.
 */
export function OceanBackdrop({ meters, surface }: { meters: MotionValue<number>; surface: MotionValue<number> }) {
  const background = useTransform([meters, surface], ([m, s]: number[]) => {
    const line = clamp(s * 100, 30, 90);
    const deep = rgb(colorAt(Math.max(m, 120)));
    const deeper = rgb(colorAt(Math.max(m, 120) * 1.6 + 200));
    // The waterline rises off the top of the screen as the camera sinks.
    const sunk = ramp(m, 0, 40);
    const waterTop = line * (1 - sunk);
    if (sunk >= 1) return `linear-gradient(180deg, ${deep} 0%, ${deeper} 100%)`;
    return (
      `linear-gradient(180deg, #dcecf7 0%, #b4d4ee ${Math.max(0, waterTop - 1)}%, ` +
      `#e9f5fb ${waterTop}%, #3a9ab6 ${waterTop + 0.6}%, ${deep} ${waterTop + 22}%, ${deeper} 100%)`
    );
  });

  return <motion.div aria-hidden className="pointer-events-none fixed inset-0 z-[-10]" style={{ background }} />;
}
