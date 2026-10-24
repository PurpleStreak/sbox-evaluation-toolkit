import LockIcon from './LockIcon.jsx';
import { baselineHistogram, compareToBaseline, getPresetSummary } from '../core/baseline.js';
import { getMetric } from '../core/metrics.js';
import { beatsText } from '../core/verdict.js';
import { fmt } from '../lib/format.js';

/** Metrics shown as strips, in display order. */
const STRIPS = [
  'differentialUniformity',
  'nonlinearity',
  'boomerangUniformity',
  'absoluteIndicator',
  'minComponentDegree',
  'quadraticEquations',
  'sacMean',
  'fixedPoints',
];

/** Reference S-box drawn on the strips for each size. */
const REFERENCE = /** @type {Record<number, { id: string, name: string }>} */ ({
  8: { id: 'aes', name: 'AES' },
  4: { id: 'present', name: 'PRESENT' },
});

/**
 * @param {object} props
 * @param {import('../core/analyze.js').Analysis} props.analysis
 * @param {import('../core/analyze.js').Analysis | null} props.prev  Previous analysis after a related edit.
 */
export default function MetricStrips({ analysis, prev }) {
  const { n, m } = analysis.properties;
  const ref = REFERENCE[n];
  const refSummary = ref ? getPresetSummary(ref.id) : undefined;

  return (
    <>
      <h3>
        Metrics <span className="small muted">vs random permutations</span>
      </h3>
      <div className="strip-legend small">
        <span className="key you" /> this S-box
        {ref && (<><span className="key ref" /> {ref.name}</>)}
        <span className="key hist" /> 10,000 random
      </div>
      <div className="metrics">
        {STRIPS.map((id) => {
          const def = getMetric(id);
          const v = def.get(analysis);
          if (v === null) return null;
          const before = prev ? def.get(prev) : null;
          const hist = n === m ? baselineHistogram(id, n) : null;
          const cmp = n === m ? compareToBaseline(id, n, v) : null;
          const refV = refSummary?.metrics[id] ?? null;
          const changed = before !== null && before !== v;
          const improved =
            def.better === 'higher' ? v > (before ?? v) : def.better === 'lower' ? v < (before ?? v) : Math.abs(v - 0.5) < Math.abs((before ?? v) - 0.5);
          return (
            <div className={`strip${changed ? ' changed' : ''}`} key={`${id}-${changed ? before : ''}`}>
              <div className="row">
                <span className="name">
                  {def.affineInvariant && <LockIcon />} {def.label}
                </span>
                <span className="v">
                  {changed ? (
                    <span className={`delta ${improved ? 'up' : 'down'}`}>
                      {fmt(before)} → {fmt(v)} {improved ? '▲' : '▼'}
                    </span>
                  ) : (
                    fmt(v)
                  )}
                </span>
              </div>
              {hist && <Strip hist={hist} value={v} refValue={refV} refName={ref?.name ?? ''} />}
              <div className="pct">
                {cmp ? (
                  `${def.better === 'closer-to-half' ? `closer to ½ than ${Math.round(cmp.betterThan * 100)}% of random` : beatsText(cmp)} · random median ${fmt(cmp.median)}`
                ) : (
                  <span className="muted">no random baseline for {n}→{m} bits</span>
                )}
                {def.better !== 'none' && <span> · {def.better.replace(/-/g, ' ')} is better</span>}
              </div>
              <p className="desc">{def.description}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}

/**
 * Histogram of the random baseline with markers for this S-box and the reference.
 * @param {object} props
 * @param {[number, number][]} props.hist
 * @param {number} props.value
 * @param {number | null} props.refValue
 * @param {string} props.refName
 */
function Strip({ hist, value, refValue, refName }) {
  const W = 300;
  const H = 40;
  const pad = 8;
  const values = [value, ...(refValue !== null ? [refValue] : []), ...hist.map((h) => h[0])];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi === lo) {
    lo -= 1;
    hi += 1;
  }
  const x = (/** @type {number} */ v) => pad + ((v - lo) / (hi - lo)) * (W - 2 * pad);

  // Discrete metrics keep one bar per value; continuous ones are binned.
  const discrete = hist.length <= 40;
  /** @type {[number, number][]} */
  let bins = hist;
  if (!discrete) {
    const nb = 40;
    const acc = Array.from({ length: nb }, (_, i) => /** @type {[number, number]} */ ([lo + ((i + 0.5) * (hi - lo)) / nb, 0]));
    for (const [v, c] of hist) acc[Math.min(nb - 1, Math.floor(((v - lo) / (hi - lo)) * nb))][1] += c;
    bins = acc.filter((b) => b[1] > 0);
  }
  let step = Infinity;
  for (let i = 1; i < hist.length; i++) step = Math.min(step, hist[i][0] - hist[i - 1][0]);
  const bw = discrete
    ? Math.max(2, Math.min(14, (W - 2 * pad) / ((hi - lo) / (Number.isFinite(step) ? step : 1) + 1) - 2))
    : (W - 2 * pad) / 40 - 2;
  const maxC = Math.max(...bins.map((b) => b[1]));
  const label = (/** @type {number} */ v) => (Number.isInteger(v) ? String(v) : v.toFixed(4));

  /** @param {number} v @param {string} color @param {string} name */
  const marker = (v, color, name) => (
    <g>
      <line x1={x(v)} x2={x(v)} y1={2} y2={H - 4} stroke={`var(${color})`} strokeWidth={2} />
      <circle cx={x(v)} cy={6} r={4} fill={`var(${color})`} stroke="var(--panel)" strokeWidth={2}>
        <title>
          {name}: {label(v)}
        </title>
      </circle>
    </g>
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`This S-box ${label(value)} against the random distribution`}>
      <line x1={pad} x2={W - pad} y1={H - 4} y2={H - 4} stroke="var(--grid)" />
      {bins.map(([v, c]) => {
        const h = Math.max(1.5, (c / maxC) * (H - 12));
        return (
          <rect key={v} x={x(v) - bw / 2} y={H - 4 - h} width={bw} height={h} rx={2} fill="var(--hist)">
            <title>
              {label(v)}: {c} random S-boxes
            </title>
          </rect>
        );
      })}
      {refValue !== null && marker(refValue, '--ref', refName)}
      {marker(value, '--you', 'This S-box')}
    </svg>
  );
}
