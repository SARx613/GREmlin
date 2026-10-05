type Props = { value: number; color?: string; thin?: boolean };

/** `value` entre 0 et 1. */
export default function ProgressBar({ value, color = 'bg-green', thin }: Props) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-line ${thin ? 'h-2.5' : 'h-4'}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`h-full rounded-full transition-[width] duration-150 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
