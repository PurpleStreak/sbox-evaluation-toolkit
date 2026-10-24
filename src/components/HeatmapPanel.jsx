import { useMemo, useState } from 'react';
import Heatmap from './Heatmap.jsx';
import { get } from '../core/matrix.js';
import { cssVar, sequential } from '../lib/colors.js';
import { hex, hexWidth } from '../lib/format.js';
import { TABLES, TABLE_IDS, tableStats } from '../lib/tables.js';

/**
 * @param {object} props
 * @param {import('../core/analyze.js').Analysis} props.analysis
 * @param {import('../lib/tables.js').TableId} props.table
 * @param {(t: import('../lib/tables.js').TableId) => void} props.onTable
 * @param {{ r: number, c: number } | null} props.selected
 * @param {(cell: { r: number, c: number }) => void} props.onSelect
 */
export default function HeatmapPanel({ analysis, table, onTable, selected, onSelect }) {
  const [logScale, setLogScale] = useState(false);
  const [outlineMax, setOutlineMax] = useState(true);
  const [hover, setHover] = useState(/** @type {{ r: number, c: number, x: number, y: number } | null} */ (null));

  const info = TABLES[table];
  const matrix = /** @type {import('../core/matrix.js').Matrix} */ (analysis.tables[table]);
  const { max, maxCount } = useMemo(() => tableStats(matrix, info.trivialCol), [matrix, info.trivialCol]);
  const { n, m } = analysis.properties;
  const size = 1 << n;
  // Outlining hundreds of tied maxima turns into noise; only do it when it is informative.
  const outline = outlineMax && maxCount <= 64;

  const legendGradient = useMemo(() => {
    if (info.signed) return `linear-gradient(to top, ${cssVar('--div-neg')}, ${cssVar('--div-mid')}, ${cssVar('--div-pos')})`;
    const stops = [0.15, 0.4, 0.7, 1].map((t) => `rgb(${sequential(t).join(',')})`);
    return `linear-gradient(to top, ${cssVar('--surface')}, ${stops.join(', ')})`;
  }, [info.signed]);

  /** @param {number} r @param {number} c */
  const tooltip = (r, c) => {
    const v = get(matrix, r, c);
    const head = (
      <>
        a = <b>{hex(r, hexWidth(n))}</b> · b = <b>{hex(c, hexWidth(m))}</b>
      </>
    );
    switch (table) {
      case 'ddt':
        return (<>{head}<br />DDT = <b>{v}</b> (p = {v}/{size})</>);
      case 'lat':
        return (<>{head}<br />LAT = <b>{v > 0 ? '+' : ''}{v}</b> (bias {(v / size).toFixed(3)})</>);
      case 'bct':
        return (<>{head}<br />BCT = <b>{v}</b> of {size}</>);
      default:
        return (<>{head}<br />DLCT = <b>{v > 0 ? '+' : ''}{v}</b></>);
    }
  };

  return (
    <section className="panel heat" aria-label="Cryptographic tables">
      <div className="heat-head">
        <div className="tabs" role="tablist">
          {TABLE_IDS.map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={table === id}
              className={table === id ? 'on' : ''}
              disabled={!analysis.tables[id]}
              title={analysis.tables[id] ? TABLES[id].title : `${TABLES[id].short} is only defined for permutations`}
              onClick={() => onTable(id)}
            >
              {TABLES[id].short}
            </button>
          ))}
        </div>
        <div className="heat-opts">
          <label className="check"><input type="checkbox" checked={logScale} onChange={(e) => setLogScale(e.target.checked)} /> log scale</label>
          <label className="check"><input type="checkbox" checked={outlineMax} onChange={(e) => setOutlineMax(e.target.checked)} /> outline maxima</label>
        </div>
      </div>
      <p className="small muted">{info.blurb}</p>

      <div className="heat-body">
        <div className="axis-y" aria-hidden="true">← {info.rows}</div>
        <div className="canvas-wrap">
          <div className="axis-x" aria-hidden="true">{info.cols} →</div>
          <Heatmap
            matrix={matrix}
            signed={info.signed}
            trivialCol={info.trivialCol}
            max={max}
            logScale={logScale}
            outlineMax={outline}
            selected={selected}
            onHover={setHover}
            onSelect={onSelect}
            label={`${info.title}, ${matrix.rows} by ${matrix.cols}. Use arrow keys to move the selection.`}
          />
          {hover && (
            <div className="tooltip" style={{ left: Math.min(hover.x + 14, 360), top: hover.y + 34 }}>
              {tooltip(hover.r, hover.c)}
            </div>
          )}
        </div>
        <div className="legend">
          <span className="lab">{info.signed ? '+' : ''}{max}</span>
          <div className="bar" style={{ background: legendGradient }} />
          <span className="lab">{info.signed ? `−${max}` : 0}</span>
          <span>{logScale ? 'log' : 'linear'}</span>
          <span className="lab" title="Cells at the maximum value">{maxCount} at max</span>
          <span className="lab trivial-key"><i /> trivial</span>
        </div>
      </div>
    </section>
  );
}
