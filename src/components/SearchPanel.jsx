import { useEffect, useRef, useState } from 'react';
import Sparkline from './Sparkline.jsx';
import { randomSeed } from '../core/random.js';
import { startSearch } from '../lib/searchClient.js';

/**
 * Heuristic (simulated-annealing) search running in a Web Worker, with live progress.
 * @param {object} props
 * @param {(sbox: import('../core/sbox.js').SBox, name: string, opts?: { related?: boolean }) => unknown} props.onLoad
 * @param {(msg: string) => void} props.onToast
 */
export default function SearchPanel({ onLoad, onToast }) {
  const [n, setN] = useState(8);
  const [iterations, setIterations] = useState(20000);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [history, setHistory] = useState(/** @type {{ nl: number, du: number }[]} */ ([]));
  const handle = useRef(/** @type {{ cancel: () => void } | null} */ (null));

  // Stop a running search if the panel unmounts.
  useEffect(() => () => handle.current?.cancel(), []);

  const run = () => {
    const seed = randomSeed();
    const name = `Search ${n}-bit #${seed.toString(16)}`;
    setRunning(true);
    setHistory([]);
    let lastLoad = 0;
    let first = true;
    handle.current = startSearch(
      { n, seed, iterations },
      ({ stats, best, done, cancelled }) => {
        setHistory((h) => [...h, { nl: stats.best.nonlinearity, du: stats.best.uniformity }]);
        setStatus(
          `${done ? (cancelled ? 'Cancelled' : 'Done') : 'Running'} · ${stats.iteration.toLocaleString('en-US')} / ${stats.iterations.toLocaleString('en-US')} moves · best NL ${stats.best.nonlinearity}, δ ${stats.best.uniformity}`,
        );
        // Re-analysing costs ~80 ms for 8 bits, so refresh the view at most every 700 ms.
        const now = performance.now();
        if (done || now - lastLoad > 700) {
          lastLoad = now;
          onLoad(best, name, { related: !first });
          first = false;
        }
        if (done) {
          setRunning(false);
          handle.current = null;
          if (!cancelled) onToast(`Search finished: NL ${stats.best.nonlinearity}, δ ${stats.best.uniformity} after ${stats.iteration.toLocaleString('en-US')} moves.`);
        }
      },
      (message) => {
        setStatus(`Error: ${message}`);
        setRunning(false);
      },
    );
  };

  return (
    <div className="group">
      <span className="lbl">
        Heuristic search <span className="chip warn">heavy</span>
      </span>
      <p className="explain-only small muted">
        Simulated annealing swaps entries of a random permutation to raise nonlinearity and lower δ. Runs in the background; the
        best S-box so far is shown live.
      </p>
      <div className="inline-fields">
        <label className="lbl small">
          bits
          <select value={n} onChange={(e) => setN(Number(e.target.value))} disabled={running}>
            {[4, 5, 6, 7, 8].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="lbl small">
          moves
          <select value={iterations} onChange={(e) => setIterations(Number(e.target.value))} disabled={running}>
            {[5000, 20000, 50000].map((v) => (
              <option key={v} value={v}>{v.toLocaleString('en-US')}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="btn-row">
        <button className="primary" onClick={run} disabled={running}>
          Run search
        </button>
        <button onClick={() => handle.current?.cancel()} disabled={!running}>
          Cancel
        </button>
      </div>
      <div className="small muted" aria-live="polite">{status}</div>
      {history.length > 0 && (
        <>
          <Sparkline values={history.map((h) => h.nl)} label="NL ↑" />
          <Sparkline values={history.map((h) => h.du)} label="δ ↓" lowerIsBetter />
        </>
      )}
    </div>
  );
}
