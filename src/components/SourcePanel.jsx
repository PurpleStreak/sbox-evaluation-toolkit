import { useMemo, useState } from 'react';
import SearchPanel from './SearchPanel.jsx';
import { AES_AFFINE, affineTransform, notableExponents, powerMap, randomAffineMap, randomPermutation } from '../core/generators.js';
import { METRICS } from '../core/metrics.js';
import { PRESETS } from '../core/presets.js';
import { randomSeed } from '../core/random.js';
import { parseSBox } from '../core/sbox.js';

/**
 * @typedef {(sbox: import('../core/sbox.js').SBox, name: string, opts?: { related?: boolean }) => import('../core/analyze.js').Analysis} LoadFn
 */

/**
 * Where S-boxes come from: reference S-boxes, generators, paste, and experiments.
 * @param {object} props
 * @param {string} props.currentName
 * @param {import('../core/analyze.js').Analysis} props.analysis
 * @param {LoadFn} props.onLoad
 * @param {(msg: string) => void} props.onToast
 */
export default function SourcePanel({ currentName, analysis, onLoad, onToast }) {
  const [pmBits, setPmBits] = useState(8);
  const exponents = useMemo(() => notableExponents(pmBits), [pmBits]);
  const [pmExp, setPmExp] = useState(254);
  const [pmOut, setPmOut] = useState(/** @type {'aes' | 'none' | 'random'} */ ('aes'));
  const [paste, setPaste] = useState('');
  const [pasteFormat, setPasteFormat] = useState(/** @type {'auto' | 'hex' | 'dec'} */ ('auto'));
  const [pasteError, setPasteError] = useState('');

  const exponent = exponents.some((e) => e.exponent === pmExp) ? pmExp : exponents[0].exponent;
  const baseName = currentName.replace(/ \((edited|affine)[^)]*\)$/, '');

  const buildPowerMap = () => {
    const seed = randomSeed();
    const outputMap = pmOut === 'aes' && pmBits === 8 ? AES_AFFINE : pmOut === 'random' ? randomAffineMap(pmBits, seed) : undefined;
    const { sbox, bijective } = powerMap({ n: pmBits, exponent, outputMap });
    const suffix = outputMap ? (pmOut === 'aes' ? ' + AES affine' : ` + affine #${seed.toString(16)}`) : '';
    onLoad(sbox, `x^${exponent} over GF(2^${pmBits})${suffix}`);
    if (!bijective) onToast(`x^${exponent} is not a permutation of GF(2^${pmBits}): gcd(${exponent}, ${(1 << pmBits) - 1}) ≠ 1.`);
  };

  const affineDemo = () => {
    const s = analysis.sbox;
    if (s.n !== s.m) {
      onToast('The affine experiment needs an n→n S-box.');
      return;
    }
    const seed = randomSeed();
    const next = onLoad(affineTransform(s, randomAffineMap(s.n, seed), randomAffineMap(s.n, seed + 1)), `${baseName} (affine #${seed.toString(16)})`, {
      related: true,
    });
    const changed = METRICS.filter((m) => m.get(next) !== m.get(analysis));
    const brokeInvariant = changed.some((m) => m.affineInvariant);
    onToast(
      changed.length === 0
        ? 'Affine re-encoding: no metric changed.'
        : `Affine re-encoding changed ${changed.length} metric${changed.length > 1 ? 's' : ''}${brokeInvariant ? '' : ', none of them locked'}: ${changed.map((m) => m.label).join(', ')}.`,
    );
  };

  const loadPaste = () => {
    try {
      onLoad(parseSBox(paste, { format: pasteFormat }), 'Pasted S-box');
      setPasteError('');
    } catch (err) {
      setPasteError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <aside className="panel source" aria-label="S-box source">
      <h3>Source</h3>

      <div className="group">
        <span className="lbl">Reference S-boxes</span>
        <div className="preset-list">
          {PRESETS.map((p) => (
            <button key={p.id} className={currentName === p.name ? 'on' : ''} title={`${p.cipher} (${p.year}): ${p.note}`} onClick={() => onLoad(p.sbox, p.name)}>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="group">
        <span className="lbl">Generate</span>
        <div className="btn-col">
          <button onClick={() => { const s = randomSeed(); onLoad(randomPermutation(8, s), `Random 8-bit #${s.toString(16)}`); }}>
            Random 8-bit permutation
          </button>
          <button onClick={() => { const s = randomSeed(); onLoad(randomPermutation(4, s), `Random 4-bit #${s.toString(16)}`); }}>
            Random 4-bit permutation
          </button>
        </div>
        <div className="power">
          <span className="lbl small">Power map S(x) = A(x<sup>d</sup>) over GF(2ⁿ)</span>
          <div className="inline-fields">
            <label className="lbl small">
              bits
              <select value={pmBits} onChange={(e) => setPmBits(Number(e.target.value))}>
                {[3, 4, 5, 6, 7, 8].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="lbl small grow">
              exponent d
              <select value={exponent} onChange={(e) => setPmExp(Number(e.target.value))}>
                {exponents.map((e) => (
                  <option key={e.exponent} value={e.exponent} title={e.note}>
                    {e.name} — d = {e.exponent}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="lbl small">
            output map A
            <select value={pmOut} onChange={(e) => setPmOut(/** @type {'aes' | 'none' | 'random'} */ (e.target.value))}>
              <option value="aes" disabled={pmBits !== 8}>AES affine map (8-bit)</option>
              <option value="none">none</option>
              <option value="random">random affine map</option>
            </select>
          </label>
          <button onClick={buildPowerMap}>Build power map</button>
        </div>
      </div>

      <SearchPanel onLoad={onLoad} onToast={onToast} />

      <div className="group">
        <label className="lbl" htmlFor="paste">Paste</label>
        <textarea id="paste" rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="0x63, 0x7c, … · C array · C56B90AD3EF84712" />
        <div className="btn-row">
          <select value={pasteFormat} onChange={(e) => setPasteFormat(/** @type {'auto' | 'hex' | 'dec'} */ (e.target.value))} aria-label="Number format">
            <option value="auto">auto</option>
            <option value="hex">hex</option>
            <option value="dec">decimal</option>
          </select>
          <button onClick={loadPaste} disabled={!paste.trim()}>Load</button>
        </div>
        <div className="small err" role="alert">{pasteError}</div>
      </div>

      <div className="group">
        <span className="lbl">Experiments</span>
        <button onClick={affineDemo}>Apply random affine transform</button>
        <p className="explain-only small muted">
          Re-encodes the S-box as B∘S∘A with random affine maps. Metrics marked with a lock cannot change; watch the others move.
        </p>
      </div>
    </aside>
  );
}
