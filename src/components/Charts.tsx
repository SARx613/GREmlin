// Deux petits graphiques SVG sans dépendance : courbe (mots maîtrisés) et barres (leçons par jour).
const W = 600;
const H = 200;
const PAD = { l: 36, r: 12, t: 12, b: 28 };

const niceMax = (v: number) => {
  if (v <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / step) * step;
};

type Props = { values: number[]; labels: string[]; label: string };

function Frame({ max, children, label }: { max: number; children: React.ReactNode; label: string }) {
  const ticks = [0, max / 2, max];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full">
      {ticks.map((t) => {
        const y = PAD.t + (1 - t / max) * (H - PAD.t - PAD.b);
        return (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="var(--line)" strokeWidth={t === 0 ? 2 : 1} />
            <text x={PAD.l - 6} y={y + 4} textAnchor="end" fontSize={12} fill="var(--muted)">
              {Math.round(t)}
            </text>
          </g>
        );
      })}
      {children}
    </svg>
  );
}

const XLabels = ({ labels }: { labels: string[] }) => (
  <>
    {[0, labels.length - 1].map((i) => (
      <text
        key={i}
        x={PAD.l + (i / Math.max(labels.length - 1, 1)) * (W - PAD.l - PAD.r)}
        y={H - 8}
        textAnchor={i === 0 ? 'start' : 'end'}
        fontSize={12}
        fill="var(--muted)"
      >
        {labels[i]}
      </text>
    ))}
  </>
);

export function LineChart({ values, labels, label }: Props) {
  const max = niceMax(Math.max(...values, 1));
  const x = (i: number) => PAD.l + (i / Math.max(values.length - 1, 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(values.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`;
  return (
    <Frame max={max} label={label}>
      <path d={area} fill="#58CC02" opacity={0.18} />
      <path d={line} fill="none" stroke="#58CC02" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={6} fill="#58CC02" />
      <XLabels labels={labels} />
    </Frame>
  );
}

export function BarChart({ values, labels, label }: Props) {
  const max = niceMax(Math.max(...values, 1));
  const slot = (W - PAD.l - PAD.r) / values.length;
  return (
    <Frame max={max} label={label}>
      {values.map((v, i) => {
        const h = (v / max) * (H - PAD.t - PAD.b);
        return (
          <g key={i}>
            <rect x={PAD.l + i * slot + slot * 0.15} width={slot * 0.7} y={H - PAD.b - h} height={h} rx={4} fill="#1CB0F6" />
            {v > 0 && (
              <text x={PAD.l + i * slot + slot / 2} y={H - PAD.b - h - 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--ink)">
                {v}
              </text>
            )}
          </g>
        );
      })}
      <XLabels labels={labels} />
    </Frame>
  );
}
