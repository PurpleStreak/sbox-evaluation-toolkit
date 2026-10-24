import { useMemo } from 'react';
import { differentialPairs } from '../core/differential.js';
import { get } from '../core/matrix.js';
import { hex, hexWidth } from '../lib/format.js';
import { TABLES, isTrivial, lineStats, strongestCell, valueDistribution } from '../lib/tables.js';

/**
 * Linear combination of bits, e.g. mask 0b101 → "x0 ⊕ x2".
 * @param {number} mask
 * @param {string} v
 * @param {number} bits
 */
function bitsExpr(mask, v, bits) {
  const parts = [];
  for (let i = 0; i < bits; i++) if ((mask >> i) & 1) parts.push(`${v}${i}`);
  return parts.length ? parts.join(' ⊕ ') : '0';
}

/** @param {number} v @param {number} bits */
const bin = (v, bits) => v.toString(2).padStart(bits, '0');

/** Power-of-two form of a probability or bias: 2^-6, or 2^-1.4 when not exact. @param {number} p */
const pow2 = (p) => {
  if (p <= 0) return '0';
  const e = Math.log2(p);
  return `2^${Number.isInteger(e) ? e : e.toFixed(1)}`;
};

/** Each table's headline metric (its non-trivial maximum). */
const MAX_NAME = {
  ddt: 'Largest entry = δ (differential uniformity)',
  lat: 'Largest |entry| — sets the nonlinearity (NL = 2ⁿ⁻¹ − max)',
  bct: 'Largest entry = β (boomerang uniformity)',
  dlct: 'Largest |entry| — half the absolute indicator',
};

/** How to read each table, shown before a cell is selected. */
const GUIDE = {
  ddt: 'Row a is an input difference, column b an output difference. Each cell counts the inputs x with S(x) ⊕ S(x ⊕ a) = b. Large counts are predictable differences that differential attacks chain through rounds.',
  lat: 'Row a is an input mask, column b an output mask. Each cell says how far the equation a·x = b·S(x) is from holding exactly half the time. Large |values| are linear approximations that linear attacks exploit.',
  bct: 'Row a is an input difference, column b an output difference. Each cell counts how often a boomerang pair returns at this S-box. It is never smaller than the DDT entry; large values help boomerang attacks.',
  dlct: 'Row a is an input difference, column b an output mask. Each cell is the bias of b·(S(x) ⊕ S(x ⊕ a)). Large |values| link a differential to a linear approximation; ±2ⁿ⁻¹ is a linear structure.',
};

/**
 * Explains the selected table cell in detail: what it counts, the concrete evidence,
 * what it would give an attacker, and how it compares with the rest of the table.
 * @param {object} props
 * @param {import('../core/analyze.js').Analysis} props.analysis
 * @param {import('../lib/tables.js').TableId} props.table
 * @param {{ r: number, c: number } | null} props.selected
 * @param {(cell: { r: number, c: number }) => void} props.onSelect
 */
export default function Inspector({ analysis, table, selected, onSelect }) {
  const info = TABLES[table];
  const matrix = /** @type {import('../core/matrix.js').Matrix} */ (analysis.tables[table]);
  const distribution = useMemo(() => valueDistribution(matrix, info.trivialCol), [matrix, info.trivialCol]);
  const tableMax = distribution.length ? distribution[distribution.length - 1][0] : 0;
  const atMax = distribution.length ? distribution[distribution.length - 1][1] : 0;
  const strongest = useMemo(() => strongestCell(matrix, info.trivialCol), [matrix, info.trivialCol]);

  const s = analysis.sbox;
  const size = 1 << s.n;
  const wi = hexWidth(s.n);
  const wo = hexWidth(s.m);

  const context = (
    <section className="insp-section">
      <h4>This table</h4>
      <div className="stat">
        <div className="small muted">{MAX_NAME[table]}</div>
        <div>
          <b>{tableMax}</b> <span className="muted">· {atMax.toLocaleString('en-US')} cell{atMax === 1 ? '' : 's'} reach it</span>
        </div>
      </div>
      <div className="stat">
        <div className="small muted">How often each {info.signed ? '|value|' : 'value'} occurs (value × cells)</div>
        <div className="mono small">{distribution.map(([v, n]) => `${v}×${n.toLocaleString('en-US')}`).join('  ·  ')}</div>
      </div>
    </section>
  );

  const jump = (
    <div className="btn-row insp-actions">
      <button onClick={() => onSelect(strongest)}>Strongest cell</button>
      {selected && selected.r > 0 && (
        <button onClick={() => onSelect(strongestCell(matrix, info.trivialCol, selected.r))}>Strongest in this row</button>
      )}
    </div>
  );

  if (!selected) {
    return (
      <div className="inspector-body">
        <div className="small muted">{info.title}</div>
        <p>{GUIDE[table]}</p>
        <p className="small muted">Click a cell (or use the arrow keys on the heatmap) to inspect it.</p>
        {jump}
        {context}
      </div>
    );
  }

  const { r: a, c: b } = selected;
  const v = get(matrix, a, b);
  const trivial = isTrivial(a, b, info.trivialCol);
  const row = lineStats(matrix, info.trivialCol, 'row', a);
  const col = lineStats(matrix, info.trivialCol, 'col', b);
  const [aName, bName] = [info.rows.replace(/ a$/, ''), info.cols.replace(/ b$/, '')];

  const coords = (
    <section className="insp-section">
      <h4>Cell</h4>
      <dl className="kv">
        <dt>a ({aName})</dt>
        <dd className="mono">
          {hex(a, wi)} = {bin(a, s.n)}
        </dd>
        <dt>b ({bName})</dt>
        <dd className="mono">
          {hex(b, wo)} = {bin(b, s.m)}
        </dd>
      </dl>
    </section>
  );

  /** @type {import('react').ReactNode} */
  let meaning;
  /** @type {import('react').ReactNode} */
  let evidence = null;
  /** @type {string | null} */
  let attack = null;

  if (trivial) {
    meaning = (
      <p>
        This is the trivial {a === 0 ? 'row' : 'column'}: with a zero {a === 0 ? aName : bName} the relation holds for every input, so it always
        holds the extreme value. Every metric ignores it.
      </p>
    );
  } else if (table === 'ddt') {
    const p = v / size;
    const pairs = differentialPairs(s, a, b).filter((x) => x < (x ^ a));
    meaning = (
      <>
        <p>
          Inputs differing by <code>{hex(a, wi)}</code> give outputs differing by <code>{hex(b, wo)}</code> for <b>{v} of {size}</b> inputs.
        </p>
        <dl className="kv">
          <dt>probability</dt>
          <dd>
            {v}/{size} = {p.toFixed(4)} = {pow2(p)}
          </dd>
          <dt>random function</dt>
          <dd>{(size / (1 << s.m)).toFixed(2)} inputs on average</dd>
        </dl>
      </>
    );
    if (pairs.length)
      evidence = (
        <section className="insp-section">
          <h4>The {pairs.length} input pair{pairs.length === 1 ? '' : 's'} behind it</h4>
          <div className="pairs">
            {pairs.map((x) => (
              <div key={x}>
                {hex(x, wi)}→{hex(s.table[x], wo)} · {hex(x ^ a, wi)}→{hex(s.table[x ^ a], wo)}
              </div>
            ))}
          </div>
          <p className="small muted">Each line: (x, x ⊕ a) → (S(x), S(x ⊕ a)); the two outputs always differ by {hex(b, wo)}.</p>
        </section>
      );
    if (v) attack = `A differential trail that uses this transition multiplies its probability by ${pow2(p)} at every S-box where it occurs.`;
  } else if (table === 'lat') {
    const count = v + size / 2;
    const bias = v / size;
    meaning = (
      <>
        <div className="eq">
          {bitsExpr(a, 'x', s.n)} = {bitsExpr(b, 'y', s.m)}
        </div>
        <p>
          This linear equation between input bits x and output bits y = S(x) holds for <b>{count} of {size}</b> inputs; a coin flip would give{' '}
          {size / 2}.
        </p>
        <dl className="kv">
          <dt>probability</dt>
          <dd>
            {count}/{size} = {(count / size).toFixed(4)}
          </dd>
          <dt>bias ε</dt>
          <dd>
            {bias >= 0 ? '+' : ''}
            {bias.toFixed(4)} {v ? `(|ε| = ${pow2(Math.abs(bias))})` : ''}
          </dd>
          <dt>correlation</dt>
          <dd>{(2 * bias).toFixed(4)}</dd>
        </dl>
      </>
    );
    if (v)
      attack = `Detecting a bias of |ε| = ${pow2(Math.abs(bias))} needs roughly 1/ε² ≈ 2^${(-2 * Math.log2(Math.abs(bias))).toFixed(1)} known plaintexts for this one approximation (Matsui).`;
  } else if (table === 'bct') {
    const d = get(analysis.tables.ddt, a, b);
    meaning = (
      <>
        <p>
          A boomerang with input difference <code>{hex(a, wi)}</code> and output difference <code>{hex(b, wo)}</code> returns for <b>{v} of {size}</b>{' '}
          inputs.
        </p>
        <dl className="kv">
          <dt>probability</dt>
          <dd>
            {(v / size).toFixed(4)} = {pow2(v / size)}
          </dd>
          <dt>DDT at this cell</dt>
          <dd>
            {d} {v > d ? <span className="muted">· boomerang returns {v - d} more often than the DDT alone predicts</span> : null}
          </dd>
        </dl>
      </>
    );
    if (v) attack = `In a boomerang attack, the switch through this S-box succeeds with probability ${pow2(v / size)}.`;
  } else {
    const holds = v + size / 2;
    const corr = (2 * v) / size;
    meaning = (
      <>
        <div className="eq">
          {bitsExpr(b, 'y', s.m)} of S(x) ⊕ S(x ⊕ {hex(a, wi)}) = 0
        </div>
        <p>
          This holds for <b>{holds} of {size}</b> inputs; a random function would give about {size / 2}.
        </p>
        <dl className="kv">
          <dt>bias</dt>
          <dd>
            {v >= 0 ? '+' : ''}
            {(v / size).toFixed(4)}
          </dd>
          <dt>correlation</dt>
          <dd>{corr.toFixed(4)}</dd>
        </dl>
        {Math.abs(v) === size / 2 && (
          <p className="warn-text">
            <b>Linear structure:</b> the relation holds for {v > 0 ? 'every' : 'no'} input — a probability-1 property that invariant-subspace attacks build on.
          </p>
        )}
      </>
    );
    if (v) attack = `A differential-linear distinguisher through this S-box gains correlation ${corr.toFixed(4)} from this cell.`;
  }

  return (
    <div className="inspector-body">
      <div className="small muted">{info.title}</div>
      <div className="big">
        {hex(a, wi)} → {hex(b, wo)}: {info.signed && v > 0 ? '+' : ''}
        {v}
        {!trivial && Math.abs(v) === tableMax && tableMax > 0 && <span className="chip max-chip">table maximum</span>}
      </div>
      {coords}
      <section className="insp-section">
        <h4>What it means</h4>
        {meaning}
        {attack && <p className="attack-note">{attack}</p>}
      </section>
      {evidence}
      {!trivial && (
        <section className="insp-section">
          <h4>Compared with its row and column</h4>
          <dl className="kv">
            <dt>row a = {hex(a, wi)}</dt>
            <dd>
              max {row.max} · {row.nonZero} of {row.cells} non-zero
            </dd>
            <dt>column b = {hex(b, wo)}</dt>
            <dd>
              max {col.max} · {col.nonZero} of {col.cells} non-zero
            </dd>
          </dl>
        </section>
      )}
      {jump}
      {context}
    </div>
  );
}
