import { useState } from 'react';
import SearchPanel from './SearchPanel.jsx';
import { randomPermutation } from '../core/generators.js';
import { PRESETS } from '../core/presets.js';
import { randomSeed } from '../core/random.js';
import { parseSBox } from '../core/sbox.js';

/**
 * @typedef {(sbox: import('../core/sbox.js').SBox, name: string, opts?: { keepView?: boolean }) => import('../core/analyze.js').Analysis} LoadFn
 */

/**
 * Where S-boxes come from: reference S-boxes, random permutations, paste and, under
 * Advanced (collapsed by default), the heuristic search.
 * @param {object} props
 * @param {string} props.currentName
 * @param {LoadFn} props.onLoad
 */
export default function SourcePanel({ currentName, onLoad }) {
  const [paste, setPaste] = useState('');
  const [pasteFormat, setPasteFormat] = useState(/** @type {'auto' | 'hex' | 'dec'} */ ('auto'));
  const [pasteError, setPasteError] = useState('');

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
        <span className="lbl">Random permutation</span>
        <div className="btn-col">
          <button onClick={() => { const s = randomSeed(); onLoad(randomPermutation(8, s), `Random 8-bit #${s.toString(16)}`); }}>
            Random 8-bit
          </button>
          <button onClick={() => { const s = randomSeed(); onLoad(randomPermutation(4, s), `Random 4-bit #${s.toString(16)}`); }}>
            Random 4-bit
          </button>
        </div>
      </div>

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

      {/* Collapsed by default; content stays mounted, so a running search continues when closed. */}
      <details className="advanced">
        <summary className="lbl">Advanced</summary>
        <SearchPanel onLoad={onLoad} />
      </details>

    </aside>
  );
}
