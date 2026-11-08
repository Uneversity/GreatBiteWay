import type { SVGProps } from "react";

/**
 * Miami Dade College's "MD" mark: the geometric shape from the logo, without
 * the wordmark. Three solid shapes: a right triangle, a slanted triangle and a
 * half-disc, traced from the brand artwork. Fills with `currentColor`.
 */
export const MDC_MARK_VIEWBOX = "0 0 340 212";
export const MDC_MARK_W = 340;
export const MDC_MARK_H = 212;

/** The bare shapes, for placing inside another SVG (e.g. on the shark's flag). */
export function MdcMarkShapes(props: SVGProps<SVGGElement>) {
  return (
    <g {...props}>
      <path d="M0 0 V212 H120 Z" />
      <path d="M124 0 H228 L124 212 Z" />
      <path d="M233 0 A106 106 0 0 1 233 212 Z" />
    </g>
  );
}

export function MdcMark({ className, title = "Miami Dade College" }: { className?: string; title?: string }) {
  return (
    <svg viewBox={MDC_MARK_VIEWBOX} className={className} role="img" aria-label={title} fill="currentColor">
      <MdcMarkShapes />
    </svg>
  );
}
