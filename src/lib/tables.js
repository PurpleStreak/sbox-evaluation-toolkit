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
 * First cell holding the largest non-trivial DDT entry — a sensible default selection.
 * @param {import('../core/analyze.js').Analysis} a
 * @returns {{ r: number, c: number }}
 */
export function strongestDdtCell(a) {
  const m = a.tables.ddt;
  const { max } = tableStats(m, false);
  for (let r = 1; r < m.rows; r++) for (let c = 0; c < m.cols; c++) if (get(m, r, c) === max) return { r, c };
  return { r: 1, c: 0 };
}
