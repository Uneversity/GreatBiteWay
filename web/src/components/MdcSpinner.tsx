import { MdcMark } from "@/components/MdcMark";

type Props = {
  /** Announced to screen readers and shown under the mark when `caption` is set. */
  label: string;
  caption?: React.ReactNode;
  /** Tailwind height class for the mark, e.g. "h-12". */
  size?: string;
  className?: string;
};

/** The MDC mark turning like a coin: the loading indicator for roadmaps and the AI panel. */
export function MdcSpinner({ label, caption, size = "h-12", className = "" }: Props) {
  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center gap-4 ${className}`}>
      <div className="[perspective:600px]">
        <MdcMark className={`mdc-spin ${size} w-auto`} title="" />
      </div>
      {caption ? <div className="text-center">{caption}</div> : null}
      <span className="sr-only">{label}</span>
    </div>
  );
}
