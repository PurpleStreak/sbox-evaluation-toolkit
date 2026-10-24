import { useMemo, useState } from 'react';
import SearchPanel from './SearchPanel.jsx';
import { AES_AFFINE, notableExponents, powerMap, randomAffineMap, randomPermutation } from '../core/generators.js';
import { PRESETS } from '../core/presets.js';
import { randomSeed } from '../core/random.js';
import { parseSBox } from '../core/sbox.js';

/**
 * @typedef {(sbox: import('../core/sbox.js').SBox, name: string, opts?: { related?: boolean }) => import('../core/analyze.js').Analysis} LoadFn
 */

/**
 * Where S-boxes come from: reference S-boxes, generators and paste.
 * @param {object} props
 * @param {string} props.currentName
 * @param {LoadFn} props.onLoad
 * @param {(msg: string) => void} props.onToast
 */
export default function SourcePanel({ currentName, onLoad, onToast }) {
  const [pmBits, setPmBits] = useState(8);
  const exponents = useMemo(() => notableExponents(pmBits), [pmBits]);
  const [pmExp, setPmExp] = useState(254);
  const [pmOut, setPmOut] = useState(/** @type {'aes' | 'none' | 'random'} */ ('aes'));
  const [paste, setPaste] = useState('');
  const [pasteFormat, setPasteFormat] = useState(/** @type {'auto' | 'hex' | 'dec'} */ ('auto'));
  const [pasteError, setPasteError] = useState('');

  const exponent = exponents.some((e) => e.exponent === pmExp) ? pmExp : exponents[0].exponent;

  const buildPowerMap = () => {
    const seed = randomSeed();
    const outputMap = pmOut === 'aes' && pmBits === 8 ? AES_AFFINE : pmOut === 'random' ? randomAffineMap(pmBits, seed) : undefined;
    const { sbox, bijective } = powerMap({ n: pmBits, exponent, outputMap });
    const suffix = outputMap ? (pmOut === 'aes' ? ' + AES affine' : ` + affine #${seed.toString(16)}`) : '';
    onLoad(sbox, `x^${exponent} over GF(2^${pmBits})${suffix}`);
    if (!bijective) onToast(`x^${exponent} is not a permutation of GF(2^${pmBits}): gcd(${exponent}, ${(1 << pmBits) - 1}) ≠ 1.`);
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
          <span className="lbl small">
            <span>
              Power map S(x) = A(x<sup>d</sup>) over GF(2ⁿ)
            </span>
          </span>
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

    </aside>
  );
}
