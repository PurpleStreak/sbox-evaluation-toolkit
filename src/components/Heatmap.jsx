import { useEffect, useRef, useState } from 'react';
import { cssVar, mix, rgb, sequential } from '../lib/colors.js';
import { get } from '../core/matrix.js';

/** @typedef {{ r: number, c: number }} Cell */

/**
 * Canvas heatmap of an integer table. Unsigned tables use a sequential ramp (zero = surface);
 * signed tables use a diverging blue/red ramp around a neutral grey. Small tables (≤ 16×16)
 * print their values in the cells.
 *
 * @param {object} props
 * @param {import('../core/matrix.js').Matrix} props.matrix
 * @param {boolean} props.signed
 * @param {number} props.max                Colour-scale maximum (non-trivial |entry|).
 * @param {boolean} props.logScale
 * @param {boolean} props.outlineMax        Outline cells equal to max.
 * @param {Cell | null} props.selected
 * @param {(cell: (Cell & { x: number, y: number }) | null) => void} props.onHover
 * @param {(cell: Cell) => void} props.onSelect
 * @param {string} props.label              Accessible description.
 */
export default function Heatmap({ matrix, signed, max, logScale, outlineMax, selected, onHover, onSelect, label }) {
  const canvasRef = useRef(/** @type {HTMLCanvasElement | null} */ (null));
  const [width, setWidth] = useState(512);

  // Track the rendered width so the canvas stays crisp at any size.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const m = matrix;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(((width * m.rows) / m.cols) * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const surface = rgb(cssVar('--surface'));
    const trivial = rgb(cssVar('--trivial'));
    const mid = rgb(cssVar('--div-mid'));
    const pos = rgb(cssVar('--div-pos'));
    const neg = rgb(cssVar('--div-neg'));
    const norm = (/** @type {number} */ v) => (logScale ? Math.log1p(v) / Math.log1p(max) : v / max);

    // Paint one pixel per cell, then scale up without smoothing.
    const img = new ImageData(m.cols, m.rows);
    for (let r = 0; r < m.rows; r++) {
      for (let c = 0; c < m.cols; c++) {
        const v = get(m, r, c);
        let col;
        if (r === 0 || (signed && c === 0)) col = trivial;
        else if (signed) col = v === 0 ? mid : mix(mid, v > 0 ? pos : neg, Math.min(1, norm(Math.abs(v))));
        else col = v === 0 ? surface : sequential(Math.min(1, norm(v)));
        img.data.set([col[0], col[1], col[2], 255], (r * m.cols + c) * 4);
      }
    }
    const off = document.createElement('canvas');
    off.width = m.cols;
    off.height = m.rows;
    off.getContext('2d')?.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);

    const cw = canvas.width / m.cols;
    const ch = canvas.height / m.rows;

    if (m.cols <= 16) {
      ctx.font = `${Math.max(9, Math.min(12, cw / dpr / 3)) * dpr}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const text = cssVar('--text');
      for (let r = 0; r < m.rows; r++) {
        for (let c = 0; c < m.cols; c++) {
          const v = get(m, r, c);
          if (v === 0) continue;
          const strong = Math.abs(v) / max > 0.55 && !(r === 0 || (signed && c === 0));
          // Bright high-value cells take dark text; saturated signed cells take white.
          ctx.fillStyle = strong ? (signed ? '#ffffff' : '#0b0b0b') : text;
          ctx.fillText(String(v), (c + 0.5) * cw, (r + 0.5) * ch);
        }
      }
    }

    // Small tables: outline the cell; large tables: draw a slightly larger ring so it is visible.
    const pad = m.cols > 64 ? 2 * dpr : 0;
    if (outlineMax) {
      ctx.strokeStyle = cssVar('--accent');
      ctx.lineWidth = Math.max(1, dpr);
      for (let r = 1; r < m.rows; r++)
        for (let c = signed ? 1 : 0; c < m.cols; c++)
          if (Math.abs(get(m, r, c)) === max) ctx.strokeRect(c * cw - pad, r * ch - pad, cw + 2 * pad, ch + 2 * pad);
    }
    if (selected) {
      ctx.strokeStyle = cssVar('--text');
      ctx.lineWidth = 2 * dpr;
      ctx.strokeRect(selected.c * cw - pad - dpr, selected.r * ch - pad - dpr, cw + 2 * pad + 2 * dpr, ch + 2 * pad + 2 * dpr);
    }
  }, [matrix, signed, max, logScale, outlineMax, selected, width]);

  /** @param {React.MouseEvent<HTMLCanvasElement>} e */
  const cellAt = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * matrix.cols);
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * matrix.rows);
    if (r < 0 || c < 0 || r >= matrix.rows || c >= matrix.cols) return null;
    return { r, c, x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  /** @param {React.KeyboardEvent<HTMLCanvasElement>} e  Arrow keys move the selection. */
  const onKeyDown = (e) => {
    const moves = /** @type {Record<string, [number, number]>} */ ({ ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] });
    const d = moves[e.key];
    if (!d) return;
    e.preventDefault();
    const base = selected ?? { r: 1, c: 0 };
    onSelect({
      r: Math.min(matrix.rows - 1, Math.max(0, base.r + d[0])),
      c: Math.min(matrix.cols - 1, Math.max(0, base.c + d[1])),
    });
  };

  return (
    <canvas
      ref={canvasRef}
      className="heatmap"
      style={{ aspectRatio: `${matrix.cols} / ${matrix.rows}` }}
      tabIndex={0}
      role="img"
      aria-label={label}
      onMouseMove={(e) => onHover(cellAt(e))}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => {
        const cell = cellAt(e);
        if (cell) onSelect({ r: cell.r, c: cell.c });
      }}
      onKeyDown={onKeyDown}
    />
  );
}
