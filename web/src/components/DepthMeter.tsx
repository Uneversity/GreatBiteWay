"use client";

import { motion } from "motion/react";

const MAX_METERS = 4000;

export function DepthMeter({ depth }: { depth: number }) {
  return (
    <div className="flex h-64 w-10 flex-col items-center gap-2 text-xs">
      <span>0m</span>
      <div className="relative w-2 flex-1 rounded-full bg-white/20">
        <motion.div
          className="absolute inset-x-0 top-0 rounded-full bg-white"
          animate={{ height: `${depth * 100}%` }}
          transition={{ type: "spring", stiffness: 60, damping: 15 }}
        />
      </div>
      <span>{Math.round(depth * MAX_METERS)}m</span>
    </div>
  );
}
