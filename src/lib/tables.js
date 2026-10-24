import { get } from '../core/matrix.js';

/** @typedef {'ddt' | 'lat' | 'bct' | 'dlct'} TableId */

/**
 * Display metadata for the four cryptographic tables.
 * @type {Record<TableId, { short: string, title: string, rows: string, cols: string, signed: boolean, blurb: string }>}
 */
export const TABLES = {
  ddt: {
    short: 'DDT',
    title: 'Difference Distribution Table',
    rows: 'input difference a',
    cols: 'output difference b',
    signed: false,
    blurb: 'Each cell counts how many input pairs with difference a produce output difference b. Bright cells are likely differentials an attacker can exploit.',
  },
  lat: {
    short: 'LAT',
    title: 'Linear Approximation Table (bias form)',
    rows: 'input mask a',
    cols: 'output mask b',
    signed: true,
    blurb: 'Each cell is how far the equation a·x = b·S(x) is from holding exactly half the time. Strong colours (either sign) are exploitable linear approximations.',
  },
  bct: {
    short: 'BCT',
    title: 'Boomerang Connectivity Table',
    rows: 'input difference a',
    cols: 'output difference b',
    signed: false,
    blurb: 'How often a boomerang (encrypt with difference a, decrypt with difference b) comes back. High values help boomerang attacks.',
  },
  dlct: {
    short: 'DLCT',
    title: 'Differential-Linear Connectivity Table',
    rows: 'input difference a',
    cols: 'output mask b',
    signed: true,
    blurb: 'Bias of b·(S(x) ⊕ S(x⊕a)): links a differential to a linear approximation. Strong colours help differential-linear attacks.',
  },
};

/** @type {TableId[]} */
export const TABLE_IDS = ['ddt', 'lat', 'bct', 'dlct'];

/**
 * Largest non-trivial |entry| and how many cells reach it. The trivial row 0 (and, for
 * signed tables, column 0) is excluded because it always holds the extreme value.
 * @param {import('../core/matrix.js').Matrix} m
 * @param {boolean} signed
 * @returns {{ max: number, maxCount: number }}
 */
export function tableStats(m, signed) {
  let max = 0;
  let maxCount = 0;
  for (let r = 1; r < m.rows; r++) {
    for (let c = signed ? 1 : 0; c < m.cols; c++) {
      const v = Math.abs(get(m, r, c));
      if (v > max) {
        max = v;
        maxCount = 1;
      } else if (v === max) maxCount++;
    }
  }
  return { max: max || 1, maxCount };
}

/**
 * True for the trivial row 0 and, in signed tables, the trivial column 0.
 * @param {number} r
 * @param {number} c
 * @param {boolean} signed
 */
export function isTrivial(r, c, signed) {
  return r === 0 || (signed && c === 0);
}

/**
 * First non-trivial cell with the largest |entry|, optionally restricted to one row.
 * @param {import('../core/matrix.js').Matrix} m
 * @param {boolean} signed
 * @param {number} [row]
 * @returns {{ r: number, c: number }}
 */
export function strongestCell(m, signed, row) {
  let best = { r: row ?? 1, c: signed ? 1 : 0 };
  let max = -1;
  const rows = row === undefined ? Array.from({ length: m.rows - 1 }, (_, i) => i + 1) : [row];
  for (const r of rows) {
    for (let c = 0; c < m.cols; c++) {
      if (isTrivial(r, c, signed)) continue;
      const v = Math.abs(get(m, r, c));
      if (v > max) {
        max = v;
        best = { r, c };
      }
    }
  }
  return best;
}

/**
 * First cell holding the largest non-trivial DDT entry — a sensible default selection.
 * @param {import('../core/analyze.js').Analysis} a
 * @returns {{ r: number, c: number }}
 */
export function strongestDdtCell(a) {
  return strongestCell(a.tables.ddt, false);
}

/**
 * Largest non-trivial |entry| and the number of non-zero non-trivial entries in one row or column.
 * @param {import('../core/matrix.js').Matrix} m
 * @param {boolean} signed
 * @param {'row' | 'col'} axis
 * @param {number} index
 * @returns {{ max: number, nonZero: number, cells: number }}
 */
export function lineStats(m, signed, axis, index) {
  let max = 0;
  let nonZero = 0;
  let cells = 0;
  const len = axis === 'row' ? m.cols : m.rows;
  for (let k = 0; k < len; k++) {
    const r = axis === 'row' ? index : k;
    const c = axis === 'row' ? k : index;
    if (isTrivial(r, c, signed)) continue;
    const v = Math.abs(get(m, r, c));
    cells++;
    if (v) nonZero++;
    if (v > max) max = v;
  }
  return { max, nonZero, cells };
}

/**
 * Histogram of non-trivial |entries| as [value, count] pairs, ascending.
 * @param {import('../core/matrix.js').Matrix} m
 * @param {boolean} signed
 * @returns {[number, number][]}
 */
export function valueDistribution(m, signed) {
  /** @type {Map<number, number>} */
  const counts = new Map();
  for (let r = 1; r < m.rows; r++) {
    for (let c = signed ? 1 : 0; c < m.cols; c++) {
      const v = Math.abs(get(m, r, c));
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return [...counts].sort((x, y) => x[0] - y[0]);
}
