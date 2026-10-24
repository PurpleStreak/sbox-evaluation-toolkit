import { useEffect, useMemo, useState } from 'react';
import { powerMap } from '../core/generators.js';
import { PRESETS } from '../core/presets.js';
import { isBijective } from '../core/sbox.js';
import { runEquivalence } from '../lib/equivalenceClient.js';
import { hex, hexWidth } from '../lib/format.js';

/** @typedef {import('../core/equivalence.js').EquivalenceResult} EquivalenceResult */
/** @typedef {import('../core/equivalence.js').ClassResult} ClassResult */

/**
 * Reference S-boxes to compare against, for a given size.
 * @param {number} n
 * @returns {{ key: string, name: string, sbox: import('../core/sbox.js').SBox }[]}
 */
function candidatesFor(n) {
  const list = PRESETS.filter((p) => p.sbox.n === n && p.sbox.m === n && isBijective(p.sbox)).map((p) => ({ key: p.id, name: p.name, sbox: p.sbox }));
  if (n === 8) list.push({ key: 'inv8', name: 'Inversion x²⁵⁴ in GF(2⁸)', sbox: powerMap({ n: 8, exponent: 254 }).sbox });
  return list;
}

/**
 * Affine map as bit-matrix rows plus constant (Expert mode).
 * @param {{ map: import('../core/generators.js').AffineMap, n: number, name: string }} props
 */
function MapView({ map, n, name }) {
  return (
    <div className="map-view">
      <div className="small muted">{name}(x) = M·x ⊕ {hex(map.constant, hexWidth(n))}</div>
      <pre className="mono">
        {map.matrix
          .map((row) =>
            Array.from({ length: n }, (_, j) => (row >> j) & 1)
              .join(' '),
          )
          .join('\n')}
      </pre>
    </div>
  );
}

/**
 * The affine maps A and B, collapsed by default.
 * @param {{ A: import('../core/generators.js').AffineMap, B: import('../core/generators.js').AffineMap, n: number }} props
 */
function MapsDisclosure({ A, B, n }) {
  return (
    <details className="maps-disclosure">
      <summary className="small">show the affine maps A and B</summary>
      <div className="maps">
        <MapView map={A} n={n} name="A" />
        <MapView map={B} n={n} name="B" />
      </div>
    </details>
  );
}

/**
 * Affine-equivalence results for the current S-box, computed in a Web Worker on every load.
 * @param {object} props
 * @param {import('../core/sbox.js').SBox} props.sbox
 * @param {string} props.name
 */
export default function EquivalencePanel({ sbox, name }) {
  const candidates = useMemo(() => candidatesFor(sbox.n), [sbox.n]);
  const applicable = sbox.n === sbox.m && isBijective(sbox);
  const [cls, setCls] = useState(/** @type {ClassResult | null} */ (null));
  const [results, setResults] = useState(/** @type {Record<string, { result?: EquivalenceResult, ms?: number, progress?: number }>} */ ({}));
  const [error, setError] = useState('');

  useEffect(() => {
    setCls(null);
    setResults({});
    setError('');
    if (!applicable || (candidates.length === 0 && sbox.n !== 4)) return;
    // Debounce: a running search reloads the S-box several times per second.
    let handle = /** @type {{ cancel: () => void } | null} */ (null);
    const timer = setTimeout(() => {
      handle = runEquivalence(sbox, candidates, (ev) => {
        if (ev.type === 'class') setCls(ev.result);
        else if (ev.type === 'progress') setResults((r) => ({ ...r, [ev.key]: { progress: ev.done / ev.total } }));
        else if (ev.type === 'result') setResults((r) => ({ ...r, [ev.key]: { result: ev.result, ms: ev.ms } }));
        else if (ev.type === 'error') setError(ev.message);
      });
    }, 250);
    return () => {
      clearTimeout(timer);
      handle?.cancel();
    };
  }, [sbox, candidates, applicable]);

  const equivalentTo = candidates.filter((c) => results[c.key]?.result?.status === 'equivalent');

  return (
    <section className="panel equivalence" aria-label="Affine equivalence">
      <div className="section-title">
        <h2>Affine equivalence</h2>
        {equivalentTo.length > 0 && (
          <span className="chip good">≡ {equivalentTo.map((c) => c.name).join(', ')}</span>
        )}
      </div>
      <p className="small muted">
        Two S-boxes are affine equivalent when one is the other with affine re-encodings of its input and output (S₂ = B∘S₁∘A).
        They then share every property marked with a lock, so a &ldquo;new&rdquo; S-box that is equivalent to a known one is that
        S-box in disguise. Checked with the Biryukov et al. (2003) algorithm; when equivalent, the maps A and B are found and verified.
      </p>

      {!applicable ? (
        <p className="muted small">Affine equivalence is computed for n→n permutations only.</p>
      ) : (
        <div className="eq-grid">
          {sbox.n === 4 && (
            <div className="eq-card">
              <div className="small muted">Optimal-class (Leander &amp; Poschmann 2007)</div>
              {!cls ? (
                <div className="muted">classifying…</div>
              ) : cls.status === 'optimal' ? (
                <>
                  <div className="big">{cls.label}</div>
                  <p className="small">
                    {name} is optimal (δ = 4, NL = 4) and affine equivalent to class <b>{cls.label}</b> of the 16 classes of
                    optimal 4-bit S-boxes.
                  </p>
                  <MapsDisclosure A={cls.A} B={cls.B} n={4} />
                </>
              ) : (
                <>
                  <div className="big muted">not optimal</div>
                  <p className="small muted">{cls.reason}. Only optimal 4-bit S-boxes fall into the classes G0–G15.</p>
                </>
              )}
            </div>
          )}

          {candidates.length === 0 && sbox.n !== 4 && <p className="muted small">No reference S-boxes of {sbox.n} bits to compare with.</p>}

          {candidates.map((c) => {
            const entry = results[c.key];
            const r = entry?.result;
            const same = c.sbox.table.every((v, i) => v === sbox.table[i]);
            return (
              <div className={`eq-card ${r?.status === 'equivalent' ? 'is-eq' : ''}`} key={c.key}>
                <div className="small muted">vs {c.name}</div>
                {!r ? (
                  <div className="muted">
                    checking…{entry?.progress !== undefined ? ` ${Math.round(entry.progress * 100)}%` : ''}
                  </div>
                ) : r.status === 'equivalent' ? (
                  <>
                    <div className="status-line">
                      <span className="ico good" aria-hidden="true">≡</span> {same ? 'identical' : 'equivalent'}
                    </div>
                    <p className="small muted">
                      {same ? 'same lookup table' : `${name}(x) = B(${c.name}(A(x))) · maps found in ${Math.round(entry.ms ?? 0)} ms`}
                    </p>
                    {!same && <MapsDisclosure A={r.A} B={r.B} n={sbox.n} />}
                  </>
                ) : r.status === 'not-equivalent' ? (
                  <>
                    <div className="status-line">
                      <span className="ico" aria-hidden="true">≢</span> not equivalent
                    </div>
                    <p className="small muted">{r.reason}</p>
                  </>
                ) : (
                  <p className="small muted">{r.status === 'incompatible' ? r.reason : 'cancelled'}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
      {error && <p className="err small">Equivalence check failed: {error}</p>}
    </section>
  );
}
