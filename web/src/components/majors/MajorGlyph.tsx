import type { ReactElement } from "react";

/**
 * One line illustration per major, all on a 64x64 grid with the same stroke so
 * they read as a set. Every shape has pathLength=1, which lets CSS "draw" it in
 * by animating stroke-dashoffset from 1 to 0 (see .glyph-draw in globals.css).
 */

const L = { pathLength: 1 } as const;

function gearPath(cx: number, cy: number, teeth: number, outer: number, inner: number): string {
  const pts: string[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    const corners: [number, number][] = [
      [a - step * 0.32, inner],
      [a - step * 0.18, outer],
      [a + step * 0.18, outer],
      [a + step * 0.32, inner],
    ];
    for (const [ang, r] of corners) pts.push(`${(cx + r * Math.cos(ang)).toFixed(2)} ${(cy + r * Math.sin(ang)).toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z`;
}

const GLYPHS: Record<string, ReactElement> = {
  architecture: (
    <>
      <path {...L} d="M8 24 L32 10 L56 24 Z" />
      <path {...L} d="M10 28 H54" />
      <path {...L} d="M16 30 V50 M26 30 V50 M38 30 V50 M48 30 V50" />
      <path {...L} d="M12 50 H52 M8 54 H56" />
    </>
  ),
  "mechanical-engineering": (
    <>
      <path {...L} d={gearPath(32, 32, 9, 23, 17.5)} />
      <circle {...L} cx="32" cy="32" r="8" />
      <circle {...L} cx="32" cy="32" r="2.5" />
    </>
  ),
  "culinary-arts": (
    <>
      <path {...L} d="M20 40 C11 40 9 28 18 25 C18 16 28 12 32 19 C36 12 46 16 46 25 C55 28 53 40 44 40 Z" />
      <path {...L} d="M20 40 V52 H44 V40" />
      <path {...L} d="M28 43 V49 M36 43 V49" />
    </>
  ),
  cybersecurity: (
    <>
      <path {...L} d="M22 30 V22 C22 9 42 9 42 22 V30" />
      <rect {...L} x="14" y="30" width="36" height="24" />
      <circle {...L} cx="32" cy="40" r="3" />
      <path {...L} d="M32 43 V48" />
      <path {...L} d="M50 37 H57 V32 M50 47 H55 V52" />
    </>
  ),
  "it-consulting": (
    <>
      <rect {...L} x="8" y="10" width="48" height="32" />
      <path {...L} d="M28 42 L26 52 H38 L36 42 M22 52 H42" />
      <circle {...L} cx="20" cy="30" r="3.5" />
      <circle {...L} cx="32" cy="19" r="3.5" />
      <circle {...L} cx="44" cy="29" r="3.5" />
      <path {...L} d="M22.6 27.4 L29.4 21.6 M34.8 21.4 L41.6 26.6 M23.5 30 L40.5 29.2" />
    </>
  ),
  nursing: (
    <>
      <path {...L} d="M32 53 C14 41 7 31 13 21 C19 12 29 15 32 22 C35 15 45 12 51 21 C57 31 50 41 32 53 Z" />
      <path {...L} d="M4 34 H19 L23 26 L28 42 L33 29 L36 34 H60" />
    </>
  ),
  "business-administration": (
    <>
      <rect {...L} x="9" y="22" width="46" height="30" />
      <path {...L} d="M24 22 V15 H40 V22" />
      <path {...L} d="M9 35 H29 M35 35 H55" />
      <rect {...L} x="29" y="32" width="6" height="7" />
    </>
  ),
  accounting: (
    <>
      <rect {...L} x="15" y="7" width="34" height="50" />
      <rect {...L} x="20" y="12" width="24" height="10" />
      <path {...L} d="M38 17 H41" />
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2].map((c) => <rect key={`${r}${c}`} {...L} x={21 + c * 8.5} y={28 + r * 8.5} width="5" height="5" />),
      )}
    </>
  ),
  psychology: (
    <>
      <path {...L} d="M40 56 V47 H46 C49 47 50 45 50 42 V37 L54 35 L50 28 C50 16 42 9 31 9 C20 9 13 17 13 28 C13 36 17 41 22 45 V56" />
      <path {...L} d="M32 29 C32 26 36 26 36 29 C36 33 28 34 28 28 C28 22 40 22 40 29 C40 37 25 38 24 29" />
    </>
  ),
  "biological-sciences": (
    <>
      <path {...L} d="M22 6 C22 19 42 21 42 32 C42 43 22 45 22 58" />
      <path {...L} d="M42 6 C42 19 22 21 22 32 C22 43 42 45 42 58" />
      <path {...L} d="M24 12 H40 M27 18 H37 M27 46 H37 M24 52 H40" />
    </>
  ),
  "criminal-justice": (
    <>
      <circle {...L} cx="32" cy="9" r="2.5" />
      <path {...L} d="M32 11.5 V52 M22 54 H42" />
      <path {...L} d="M13 18 H51" />
      <path {...L} d="M13 18 L7 34 M13 18 L19 34" />
      <path {...L} d="M6 34 C6 41 20 41 20 34 Z" />
      <path {...L} d="M51 18 L45 34 M51 18 L57 34" />
      <path {...L} d="M44 34 C44 41 58 41 58 34 Z" />
    </>
  ),
  "software-development": (
    <>
      <rect {...L} x="7" y="11" width="50" height="42" />
      <path {...L} d="M7 19 H57" />
      <circle {...L} cx="12" cy="15" r="1.3" />
      <circle {...L} cx="16.5" cy="15" r="1.3" />
      <circle {...L} cx="21" cy="15" r="1.3" />
      <path {...L} d="M25 29 L18 36 L25 43" />
      <path {...L} d="M39 29 L46 36 L39 43" />
      <path {...L} d="M35 27 L29 45" />
    </>
  ),
  education: (
    <>
      <path {...L} d="M32 18 C26 13 16 13 7 15 V48 C16 46 26 46 32 51" />
      <path {...L} d="M32 18 C38 13 48 13 57 15 V48 C48 46 38 46 32 51" />
      <path {...L} d="M32 18 V51" />
      <path {...L} d="M13 23 H26 M13 29 H26 M13 35 H23 M38 23 H51 M38 29 H51 M38 35 H48" />
    </>
  ),
  "graphic-design": (
    <>
      <path {...L} d="M9 50 C18 22 46 22 55 50" />
      <path {...L} d="M9 50 L18 22 M55 50 L46 22" />
      <circle {...L} cx="18" cy="22" r="2.5" />
      <circle {...L} cx="46" cy="22" r="2.5" />
      <rect {...L} x="6" y="47" width="6" height="6" />
      <rect {...L} x="52" y="47" width="6" height="6" />
      <path {...L} d="M32 8 L27 18 L32 22 L37 18 Z M32 15 V22" />
    </>
  ),
  "film-tv-production": (
    <>
      <path {...L} d="M9 17 H55 V26 H9 Z" />
      <path {...L} d="M18 17 L13 26 M28 17 L23 26 M38 17 L33 26 M48 17 L43 26" />
      <rect {...L} x="9" y="26" width="46" height="28" />
      <path {...L} d="M15 36 H35 M15 44 H29" />
    </>
  ),
};

export function MajorGlyph({ slug, className = "" }: { slug: string; className?: string }) {
  const glyph = GLYPHS[slug];
  if (!glyph) return null;
  return (
    <svg
      viewBox="0 0 64 64"
      className={`glyph-draw ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {glyph}
    </svg>
  );
}
