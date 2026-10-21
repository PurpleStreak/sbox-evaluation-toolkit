/**
 * Minimal single-series line chart for live progress.
 * @param {object} props
 * @param {number[]} props.values
 * @param {string} props.label
 * @param {boolean} [props.lowerIsBetter]  Draw so that "better" is always up.
 */
export default function Sparkline({ values, label, lowerIsBetter = false }) {
  const W = 240;
  const H = 60;
  if (values.length < 2) {
    return (
      <svg className="spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <text x="8" y="16" fontSize="11" fill="var(--muted)">{label}</text>
      </svg>
    );
  }
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values
    .map((v, i) => {
      const x = 8 + (i / (values.length - 1)) * (W - 16);
      const t = lowerIsBetter ? (hi - v) / span : (v - lo) / span;
      return `${x.toFixed(1)},${(H - 8 - t * (H - 26)).toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${values.at(-1)}`}>
      <text x="8" y="16" fontSize="11" fill="var(--muted)">
        {label}: <tspan fill="var(--text)" fontWeight="600">{values.at(-1)}</tspan>
      </text>
      <polyline points={pts} fill="none" stroke="var(--you)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
