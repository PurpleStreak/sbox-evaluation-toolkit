/**
 * Dense row-major integer matrix used for DDT, LAT, BCT and similar tables.
 * @typedef {object} Matrix
 * @property {number} rows
 * @property {number} cols
 * @property {Int32Array} data  Row-major values; entry (r, c) is data[r * cols + c].
 */

/**
 * @param {number} rows
 * @param {number} cols
 * @returns {Matrix}
 */
export function createMatrix(rows, cols) {
  return { rows, cols, data: new Int32Array(rows * cols) };
}

/**
 * @param {Matrix} m
 * @param {number} r
 * @param {number} c
 * @returns {number}
 */
export function get(m, r, c) {
  return m.data[r * m.cols + c];
}

/**
 * Maximum absolute value over all entries, optionally skipping row 0 and/or column 0
 * (the trivial row/column of most cryptographic tables).
 * @param {Matrix} m
 * @param {{ skipRow0?: boolean, skipCol0?: boolean }} [opts]
 * @returns {number}
 */
export function maxAbs(m, opts = {}) {
  const r0 = opts.skipRow0 ? 1 : 0;
  const c0 = opts.skipCol0 ? 1 : 0;
  let max = 0;
  for (let r = r0; r < m.rows; r++) {
    const base = r * m.cols;
    for (let c = c0; c < m.cols; c++) {
      const v = Math.abs(m.data[base + c]);
      if (v > max) max = v;
    }
  }
  return max;
}

/**
 * Histogram of values: Map value -> number of occurrences (same skipping rules as maxAbs).
 * @param {Matrix} m
 * @param {{ skipRow0?: boolean, skipCol0?: boolean, abs?: boolean }} [opts]
 * @returns {Map<number, number>}
 */
export function spectrum(m, opts = {}) {
  const r0 = opts.skipRow0 ? 1 : 0;
  const c0 = opts.skipCol0 ? 1 : 0;
  /** @type {Map<number, number>} */
  const counts = new Map();
  for (let r = r0; r < m.rows; r++) {
    const base = r * m.cols;
    for (let c = c0; c < m.cols; c++) {
      const v = opts.abs ? Math.abs(m.data[base + c]) : m.data[base + c];
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return new Map([...counts].sort((a, b) => a[0] - b[0]));
}
