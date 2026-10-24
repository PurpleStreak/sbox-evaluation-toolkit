import { differentialPairs } from '../core/differential.js';
import { get } from '../core/matrix.js';
import { hex, hexWidth } from '../lib/format.js';
import { TABLES } from '../lib/tables.js';

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

/**
 * Explains the selected table cell in words (Explain mode) or numbers (Expert mode).
 * @param {object} props
 * @param {import('../core/analyze.js').Analysis} props.analysis
 * @param {import('../lib/tables.js').TableId} props.table
 * @param {{ r: number, c: number } | null} props.selected
 */
export default function Inspector({ analysis, table, selected }) {
  if (!selected) return <p className="muted small">Hover the heatmap to read values; click a cell (or use the arrow keys) to explain it.</p>;
  const s = analysis.sbox;
  const { r: a, c: b } = selected;
  const info = TABLES[table];
  const matrix = /** @type {import('../core/matrix.js').Matrix} */ (analysis.tables[table]);
  const v = get(matrix, a, b);
  const size = 1 << s.n;
  const wi = hexWidth(s.n);
  const wo = hexWidth(s.m);
  const trivial = a === 0 || (info.signed && b === 0);

  let body;
  if (trivial) {
    body = <p>This is a trivial {a === 0 ? 'row' : 'column'}: it always holds the extreme value and is ignored by every metric.</p>;
  } else if (table === 'ddt') {
    const pairs = differentialPairs(s, a, b).filter((x) => x < (x ^ a));
    const avg = (size / (1 << s.m)).toFixed(2);
    body = (
      <>
        <p>
          Inputs differing by <code>{hex(a, wi)}</code> give outputs differing by <code>{hex(b, wo)}</code> for <b>{v} of {size}</b> inputs (probability {(v / size).toFixed(3)}). A random function averages {avg}.
          {v >= 4 ? ' The more such pairs, the easier a differential attack.' : ''}
        </p>
        <p className="mono">p = {v}/{size} = 2^{v ? Math.log2(v / size).toFixed(2) : '−∞'}</p>
        {pairs.length > 0 && (
          <>
            <div className="small muted">Input pairs (x, x ⊕ a) → (S(x), S(x ⊕ a)):</div>
            <div className="pairs">
              {pairs.map((x) => (
                <div key={x}>
                  {hex(x, wi)}→{hex(s.table[x], wo)} · {hex(x ^ a, wi)}→{hex(s.table[x ^ a], wo)}
                </div>
              ))}
            </div>
          </>
        )}
      </>
    );
  } else if (table === 'lat') {
    const count = v + size / 2;
    body = (
      <>
        <div className="eq">{bitsExpr(a, 'x', s.n)} = {bitsExpr(b, 'y', s.m)}</div>
        <p>
          This linear equation between input bits x and output bits y = S(x) holds for <b>{count} of {size}</b> inputs. Ideal is {size / 2} (a coin flip); the further from it, the more useful to a linear attack.
        </p>
        <p className="mono">
          Pr = {count}/{size}, bias ε = {(v / size).toFixed(4)}, correlation {((2 * v) / size).toFixed(4)}
        </p>
      </>
    );
  } else if (table === 'bct') {
    body = (
      <p>
        A boomerang with input difference <code>{hex(a, wi)}</code> and output difference <code>{hex(b, wo)}</code> returns for <b>{v} of {size}</b> inputs. The DDT alone would predict {get(analysis.tables.ddt, a, b)}.
      </p>
    );
  } else {
    body = (
      <>
        <div className="eq">{bitsExpr(b, 'y', s.m)} of S(x) ⊕ S(x ⊕ {hex(a, wi)}) = 0</div>
        <p>
          This holds for <b>{v + size / 2} of {size}</b> inputs (ideal {size / 2}).
          {Math.abs(v) === size / 2 ? <b> It always (or never) holds: a linear structure.</b> : null}
        </p>
      </>
    );
  }

  return (
    <div className="inspector-body">
      <div className="small muted">{info.title}</div>
      <div className="big">
        {hex(a, wi)} → {hex(b, wo)}: {info.signed && v > 0 ? '+' : ''}{v}
      </div>
      {body}
    </div>
  );
}
