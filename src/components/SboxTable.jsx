import { hex, hexWidth } from '../lib/format.js';

/**
 * The S-box lookup table itself, read-only. Fixed points (S(x) = x) are ringed.
 * @param {object} props
 * @param {import('../core/sbox.js').SBox} props.sbox
 */
export default function SboxTable({ sbox }) {
  const wi = hexWidth(sbox.n);
  const wo = hexWidth(sbox.m);
  const cols = Math.min(16, sbox.table.length);
  const fixed = (/** @type {number} */ x, /** @type {number} */ y) => sbox.n === sbox.m && y === x;

  return (
    <section className="panel sbox-table" aria-label="S-box lookup table">
      <div className="section-title">
        <h2>S-box table</h2>
      </div>
      <p className="small muted">
        Cell (row, column) is S(x) for x = row·{cols} + column, in hex. Fixed points (S(x) = x) are ringed. Hover a cell to see its input.
      </p>
      <div className="grid" role="list" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from(sbox.table, (y, x) => (
          <div
            key={x}
            role="listitem"
            className={fixed(x, y) ? 'fixed' : undefined}
            title={`S(${hex(x, wi)}) = ${hex(y, wo)}${fixed(x, y) ? ' (fixed point)' : ''}`}
          >
            {y.toString(16).toUpperCase().padStart(wo, '0')}
          </div>
        ))}
      </div>
    </section>
  );
}
