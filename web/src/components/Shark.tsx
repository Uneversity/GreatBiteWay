"use client";

import { motion } from "motion/react";

/** Placeholder shark mascot. Swap the SVG for real art later. */
export function Shark({ className = "" }: { className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 200 90"
      className={className}
      animate={{ y: [0, -6, 0], rotate: [0, -2, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      aria-label="Shark mascot"
      role="img"
    >
      <path d="M10 50 Q60 15 140 35 L190 20 L175 50 L190 78 L140 62 Q60 85 10 50 Z" fill="#5b7c99" />
      <path d="M85 30 L105 2 L115 33 Z" fill="#4a6a85" />
      <path d="M20 52 Q70 70 140 60 Q70 80 20 52 Z" fill="#dfe8ef" />
      <circle cx="38" cy="45" r="3.5" fill="#0b1b2b" />
      <path d="M60 46 L62 56 M66 46 L68 56 M72 46 L74 56" stroke="#3d5a73" strokeWidth="2" />
    </motion.svg>
  );
}
