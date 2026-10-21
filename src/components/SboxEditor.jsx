import { useState } from 'react';
import { createSBox } from '../core/sbox.js';
import { hex, hexWidth } from '../lib/format.js';

/**
 * The lookup table as a grid. Click two cells to swap their outputs — the whole analysis
 * updates with before/after deltas, which makes the fragility of good S-boxes tangible.
 * @param {object} props
 * @param {import('../core/sbox.js').SBox} props.sbox
 * @param {string} props.name
 * @param {(sbox: import('../core/sbox.js').SBox, name: string, opts?: { related?: boolean }) => import('../core/analyze.js').Analysis} props.onLoad
 * @param {import('../core/analyze.js').Analysis} props.analysis
 * @param {(msg: string) => void} props.onToast
 */
export default function SboxEditor({ sbox, name, onLoad, analysis, onToast }) {
  const [first, setFirst] = useState(/** @type {number | null} */ (null));
  const wi = hexWidth(sbox.n);
  const wo = hexWidth(sbox.m);
  const cols = Math.min(16, sbox.table.length);

  /** @param {number} x */
  const click = (x) => {
    if (first === null) return setFirst(x);
    if (first === x) return setFirst(null);
    const t = Array.from(sbox.table);
    [t[first], t[x]] = [t[x], t[first]];
    const next = onLoad(createSBox(t, sbox.m), `${name.replace(/ \(edited\)$/, '')} (edited)`, { related: true });
    onToast(
      `Swapped S(${hex(first, wi)}) ↔ S(${hex(x, wi)}): NL ${analysis.linear.nonlinearity} → ${next.linear.nonlinearity}, δ ${analysis.differential.uniformity} → ${next.differential.uniformity}.`,
    );
    setFirst(null);
  };

  return (
    <section className="panel editor" aria-label="S-box table editor">
      <div className="section-title">
        <h2>S-box table</h2>
        <span className="small muted">{first === null ? 'click two cells to swap their outputs' : `swap S(${hex(first, wi)}) with…`}</span>
      </div>
      <p className="explain-only small muted">
        Cell (row, column) is S(x) for x = row·{cols} + column. Fixed points (S(x) = x) are ringed. Try swapping two entries of AES and
        watch its properties change.
      </p>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from(sbox.table, (y, x) => (
          <button
            key={x}
            className={`${x === first ? 'sel' : ''} ${sbox.n === sbox.m && y === x ? 'fixed' : ''}`}
            title={`S(${hex(x, wi)}) = ${hex(y, wo)}${sbox.n === sbox.m && y === x ? ' (fixed point)' : ''}`}
            aria-label={`S of ${hex(x, wi)} is ${hex(y, wo)}`}
            aria-pressed={x === first}
            onClick={() => click(x)}
          >
            {y.toString(16).toUpperCase().padStart(wo, '0')}
          </button>
        ))}
      </div>
    </section>
  );
}
