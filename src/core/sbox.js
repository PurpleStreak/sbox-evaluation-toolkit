import { MAX_BITS, bitLength, log2Exact } from './bits.js';

/**
 * An n-bit to m-bit S-box stored as a lookup table of length 2^n.
 * @typedef {object} SBox
 * @property {number} n           Input width in bits.
 * @property {number} m           Output width in bits.
 * @property {Uint8Array} table   table[x] = S(x).
 */

/**
 * Build and validate an S-box from a list of values.
 * @param {ArrayLike<number>} values  Lookup table; length must be a power of two.
 * @param {number} [m]                Output width; inferred from the values if omitted.
 * @returns {SBox}
 */
export function createSBox(values, m) {
  const n = log2Exact(values.length);
  if (n < 1) throw new Error(`S-box length must be a power of two ≥ 2 (got ${values.length})`);
  if (n > MAX_BITS) throw new Error(`S-boxes wider than ${MAX_BITS} input bits are not supported`);

  let max = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isInteger(v) || v < 0) throw new Error(`Entry ${i} is not a non-negative integer: ${v}`);
    if (v > max) max = v;
  }

  const needed = Math.max(1, bitLength(max));
  // Default output width: n, unless every value fits in fewer bits (e.g. DES 6→4).
  const outBits = m ?? (needed < n ? needed : Math.max(n, needed));
  if (outBits > MAX_BITS) throw new Error(`Output values need ${outBits} bits; at most ${MAX_BITS} supported`);
  if (needed > outBits) throw new Error(`Value ${max} does not fit in ${outBits} output bits`);

  return { n, m: outBits, table: Uint8Array.from(values) };
}

/**
 * True when the S-box is a permutation (n = m and every output occurs exactly once).
 * @param {SBox} s
 * @returns {boolean}
 */
export function isBijective(s) {
  if (s.n !== s.m) return false;
  const seen = new Uint8Array(1 << s.m);
  for (const v of s.table) {
    if (seen[v]) return false;
    seen[v] = 1;
  }
  return true;
}

/**
 * True when every output value occurs exactly 2^(n-m) times.
 * @param {SBox} s
 * @returns {boolean}
 */
export function isBalanced(s) {
  if (s.m > s.n) return false;
  const counts = new Uint16Array(1 << s.m);
  for (const v of s.table) counts[v]++;
  const expected = 1 << (s.n - s.m);
  return counts.every((c) => c === expected);
}

/**
 * Inverse permutation of a bijective S-box.
 * @param {SBox} s
 * @returns {SBox}
 */
export function inverse(s) {
  if (!isBijective(s)) throw new Error('Only bijective S-boxes have an inverse');
  const inv = new Uint8Array(s.table.length);
  s.table.forEach((y, x) => {
    inv[y] = x;
  });
  return { n: s.n, m: s.m, table: inv };
}

/**
 * Parse an S-box from free-form text.
 *
 * Accepts comma/space/newline separated values, optional C-style braces,
 * `0x` prefixes, and compact hex strings such as `C56B90AD3EF84712`.
 * With `format: 'auto'` values are read as hex when any token has a `0x`
 * prefix or a hex letter, otherwise as decimal.
 *
 * @param {string} text
 * @param {{ format?: 'auto' | 'hex' | 'dec', m?: number }} [opts]
 * @returns {SBox}
 */
export function parseSBox(text, opts = {}) {
  const format = opts.format ?? 'auto';
  let body = text
    .replace(/\/\/.*$/gm, '') // line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // block comments
  // C/JS array literal: keep only what is inside the outermost braces
  // (C style, `S[256] = { ... }`) or, failing that, brackets (JS/Python style).
  for (const [o, c] of [['{', '}'], ['[', ']']]) {
    const open = body.indexOf(o);
    const close = body.lastIndexOf(c);
    if (open !== -1 && close > open) {
      body = body.slice(open + 1, close);
      break;
    }
  }
  const cleaned = body.replace(/[{}[\]();]/g, ' ');
  let tokens = cleaned.split(/[\s,]+/).filter(Boolean);
  if (tokens.length === 0) throw new Error('No values found');

  // A single compact hex string: 1 hex digit per entry up to 16 entries, otherwise 2.
  if (tokens.length === 1 && /^(0x)?[0-9a-f]+$/i.test(tokens[0]) && format !== 'dec') {
    const digits = tokens[0].replace(/^0x/i, '');
    if (digits.length >= 4) {
      const width = digits.length <= 16 ? 1 : 2;
      if (digits.length % width !== 0) throw new Error('Compact hex string has an odd number of digits');
      tokens = digits.match(new RegExp(`.{${width}}`, 'g')) ?? [];
      return createSBox(tokens.map((t) => parseInt(t, 16)), opts.m);
    }
  }

  const hex =
    format === 'hex' || (format === 'auto' && tokens.some((t) => /^0x/i.test(t) || /[a-f]/i.test(t)));
  const values = tokens.map((t) => {
    const body = t.replace(/^0x/i, '');
    const ok = hex ? /^[0-9a-f]+$/i.test(body) : /^\d+$/.test(body);
    if (!ok) throw new Error(`Invalid ${hex ? 'hex' : 'decimal'} value: "${t}"`);
    return parseInt(body, hex ? 16 : 10);
  });
  return createSBox(values, opts.m);
}

/**
 * Format an S-box as text.
 * @param {SBox} s
 * @param {{ format?: 'hex' | 'dec', perLine?: number }} [opts]
 * @returns {string}
 */
export function formatSBox(s, opts = {}) {
  const hex = (opts.format ?? 'hex') === 'hex';
  const perLine = opts.perLine ?? 16;
  const width = Math.ceil(s.m / 4);
  const items = Array.from(s.table, (v) =>
    hex ? '0x' + v.toString(16).toUpperCase().padStart(width, '0') : String(v),
  );
  const lines = [];
  for (let i = 0; i < items.length; i += perLine) lines.push(items.slice(i, i + perLine).join(', '));
  return lines.join(',\n');
}
