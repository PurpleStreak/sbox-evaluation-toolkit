/**
 * Hex string with a 0x prefix, zero-padded to `width` digits.
 * @param {number} v
 * @param {number} [width]
 * @returns {string}
 */
export const hex = (v, width = 2) => '0x' + v.toString(16).toUpperCase().padStart(width, '0');

/**
 * Number of hex digits needed for values of `bits` bits.
 * @param {number} bits
 * @returns {number}
 */
export const hexWidth = (bits) => Math.max(1, Math.ceil(bits / 4));

/**
 * Integers as-is, other numbers to 4 decimals, null as an em dash.
 * @param {number | null | undefined} x
 * @returns {string}
 */
export const fmt = (x) => (x === null || x === undefined ? '—' : Number.isInteger(x) ? String(x) : x.toFixed(4));
