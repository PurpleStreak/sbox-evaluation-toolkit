import { useCallback, useEffect, useState } from 'react';
import TopBar from './components/TopBar.jsx';
import { analyze } from './core/analyze.js';
import { getPreset } from './core/presets.js';
import { usePersistentState } from './lib/usePersistentState.js';

/**
 * @typedef {object} Current
 * @property {import('./core/sbox.js').SBox} sbox
 * @property {string} name
 * @property {import('./core/analyze.js').Analysis} analysis
 * @property {import('./core/analyze.js').Analysis | null} prev  Analysis before a related edit (for deltas).
 */

/** @returns {Current} */
function initial() {
  const aes = /** @type {import('./core/presets.js').Preset} */ (getPreset('aes'));
  return { sbox: aes.sbox, name: aes.name, analysis: analyze(aes.sbox), prev: null };
}

export default function App() {
  const [current, setCurrent] = useState(initial);
  const [mode, setMode] = usePersistentState('sbox.mode', /** @type {'explain' | 'expert'} */ ('explain'));
  const [theme, setTheme] = usePersistentState('sbox.theme', /** @type {'dark' | 'light'} */ ('dark'));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const load = useCallback(
    /**
     * Analyse and show an S-box.
     * @param {import('./core/sbox.js').SBox} sbox
     * @param {string} name
     * @param {{ related?: boolean }} [opts]  related: derived from the current S-box (show deltas).
     */
    (sbox, name, opts = {}) => {
      const analysis = analyze(sbox);
      setCurrent((c) => ({ sbox, name, analysis, prev: opts.related ? c.analysis : null }));
    },
    [],
  );
  void load;

  return (
    <div className={`app mode-${mode}`}>
      <TopBar
        name={current.name}
        properties={current.analysis.properties}
        mode={mode}
        onMode={setMode}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      />
      <main className="workbench" />
      <footer className="foot small muted">
        S-Box Evaluation Toolkit · B P Pranavan Paramesh (MIS 222515010) · guided by Dr. Mahesh Joshi · Dept. of CSE, IIIT Pune
      </footer>
    </div>
  );
}
