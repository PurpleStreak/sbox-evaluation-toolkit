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
