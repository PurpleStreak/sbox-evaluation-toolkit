import { useCallback, useState } from 'react';
import AdvancedSection from './components/AdvancedSection.jsx';
import EquivalencePanel from './components/EquivalencePanel.jsx';
import HeatmapPanel from './components/HeatmapPanel.jsx';
import Inspector from './components/Inspector.jsx';
import SboxTable from './components/SboxTable.jsx';
import SourcePanel from './components/SourcePanel.jsx';
import TopBar from './components/TopBar.jsx';
import VerdictRow from './components/VerdictRow.jsx';
import { analyze } from './core/analyze.js';
import { getPreset } from './core/presets.js';
import { strongestDdtCell } from './lib/tables.js';

/**
 * @typedef {object} Current
 * @property {import('./core/sbox.js').SBox} sbox
 * @property {string} name
 * @property {import('./core/analyze.js').Analysis} analysis
 */

/** @returns {Current} */
function initial() {
  const aes = /** @type {import('./core/presets.js').Preset} */ (getPreset('aes'));
  return { sbox: aes.sbox, name: aes.name, analysis: analyze(aes.sbox) };
}

export default function App() {
  const [current, setCurrent] = useState(initial);
  const [table, setTable] = useState(/** @type {import('./lib/tables.js').TableId} */ ('ddt'));
  const [selected, setSelected] = useState(
    /** @type {() => { r: number, c: number } | null} */ (() => strongestDdtCell(current.analysis)),
  );

  const load = useCallback(
    /**
     * Analyse and show an S-box.
     * @param {import('./core/sbox.js').SBox} sbox
     * @param {string} name
     * @param {{ keepView?: boolean }} [opts]  keepView: keep the selected table and cell (live search updates).
     * @returns {import('./core/analyze.js').Analysis}
     */
    (sbox, name, opts = {}) => {
      const analysis = analyze(sbox);
      setCurrent({ sbox, name, analysis });
      // A new S-box starts at its strongest differential; live search updates keep the view.
      if (!opts.keepView) {
        setTable((t) => (analysis.tables[t] ? t : 'ddt'));
        setSelected(strongestDdtCell(analysis));
      }
      return analysis;
    },
    [],
  );

  return (
    <div className="app">
      <TopBar name={current.name} properties={current.analysis.properties} />
      <VerdictRow analysis={current.analysis} />
      <main className="workbench">
        <SourcePanel currentName={current.name} onLoad={load} />
        <HeatmapPanel
          analysis={current.analysis}
          table={table}
          onTable={(t) => {
            setTable(t);
            setSelected(null);
          }}
          selected={selected}
          onSelect={setSelected}
        />
        <aside className="panel inspector">
          <h3>Inspector</h3>
          <Inspector analysis={current.analysis} table={table} selected={selected} onSelect={setSelected} />
        </aside>
      </main>
      <EquivalencePanel sbox={current.sbox} name={current.name} />
      <SboxTable sbox={current.sbox} />
      <AdvancedSection onLoad={load} />
      <footer className="foot small muted">
        S-Box Evaluation Toolkit · B P Pranavan Paramesh (MIS 222515010) · guided by Dr. Mahesh Joshi · Dept. of CSE, IIIT Pune
      </footer>
    </div>
  );
}
