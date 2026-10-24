import { describe, expect, it } from 'vitest';
import { analyze } from '../core/analyze.js';
import { PRESETS } from '../core/presets.js';
import { TABLES, lineStats, strongestCell, tableStats, valueDistribution } from './tables.js';

describe('table helpers agree with the analysis engine', () => {
  it('per-table maxima equal δ, linearity/2, β and absolute indicator/2 for every preset', () => {
    for (const p of PRESETS) {
      const a = analyze(p.sbox);
      const max = (/** @type {import('./tables.js').TableId} */ id) => tableStats(/** @type {any} */ (a.tables[id]), TABLES[id].trivialCol).max;
      expect(max('ddt'), p.id).toBe(a.differential.uniformity);
      expect(max('lat'), p.id).toBe(a.linear.linearity / 2);
      expect(max('dlct'), p.id).toBe(a.differentialLinear.absoluteIndicator / 2);
      if (a.tables.bct) expect(max('bct'), p.id).toBe(a.boomerang.uniformity); // column 0 must be ignored
    }
  });

  it('never selects or counts a trivial cell', () => {
    const a = analyze(PRESETS[0].sbox); // AES
    for (const id of /** @type {const} */ (['ddt', 'lat', 'bct', 'dlct'])) {
      const m = /** @type {import('../core/matrix.js').Matrix} */ (a.tables[id]);
      const cell = strongestCell(m, TABLES[id].trivialCol);
      expect(cell.r).toBeGreaterThan(0);
      if (TABLES[id].trivialCol) expect(cell.c).toBeGreaterThan(0);
      const rowCell = strongestCell(m, TABLES[id].trivialCol, 1);
      expect(rowCell.r).toBe(1);
      if (TABLES[id].trivialCol) expect(rowCell.c).toBeGreaterThan(0);
    }
    expect(lineStats(/** @type {any} */ (a.tables.bct), true, 'row', 1).max).toBe(6);
  });

  it('counts every non-trivial cell exactly once in the value distribution', () => {
    const a = analyze(PRESETS[0].sbox);
    const total = (/** @type {[number, number][]} */ d) => d.reduce((s, [, n]) => s + n, 0);
    expect(total(valueDistribution(a.tables.ddt, false))).toBe(255 * 256);
    expect(total(valueDistribution(/** @type {any} */ (a.tables.bct), true))).toBe(255 * 255);
  });
});
