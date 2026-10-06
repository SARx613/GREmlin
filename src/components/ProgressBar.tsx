type Props = { value: number; color?: string; thin?: boolean; secondary?: number };

/** `value` entre 0 et 1 ; `secondary` : une couche plus pâle derrière (ex. mots découverts derrière les mots maîtrisés). */
export default function ProgressBar({ value, color = 'bg-green', thin, secondary }: Props) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      className={`relative w-full overflow-hidden rounded-full bg-line ${thin ? 'h-2.5' : 'h-4'}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {secondary !== undefined && (
        <div
          className={`absolute inset-y-0 left-0 rounded-full opacity-40 transition-[width] duration-150 ${color}`}
          style={{ width: `${Math.round(Math.max(0, Math.min(1, secondary)) * 100)}%` }}
        />
      )}
      <div className={`relative h-full rounded-full transition-[width] duration-150 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
