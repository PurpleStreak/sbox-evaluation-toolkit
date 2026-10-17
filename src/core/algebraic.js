import { popcount } from './bits.js';
import { getField } from './gf.js';

/**
 * Möbius transform: truth table (0/1 per input) → algebraic normal form coefficients.
 * anf[u] = 1 iff the monomial Π_{i ∈ u} x_i appears. Self-inverse.
 * @param {Uint8Array} truth
 * @returns {Uint8Array}
 */
export function mobius(truth) {
  const v = Uint8Array.from(truth);
  for (let h = 1; h < v.length; h <<= 1)
    for (let i = 0; i < v.length; i += h << 1) for (let j = i; j < i + h; j++) v[j + h] ^= v[j];
  return v;
}

/**
 * ANF of every component function b·S, indexed by b (entry 0 is the zero function).
 * Uses linearity of the ANF: anf(b·S) is the XOR of the coordinate ANFs selected by b.
 * @param {import('./sbox.js').SBox} s
 * @returns {Uint8Array[]}
 */
export function componentAnfs(s) {
  const size = 1 << s.n;
  const coords = [];
  for (let i = 0; i < s.m; i++) coords.push(mobius(Uint8Array.from(s.table, (y) => (y >> i) & 1)));
  /** @type {Uint8Array[]} */
  const result = [new Uint8Array(size)];
  for (let b = 1; b < 1 << s.m; b++) {
    const low = b & -b;
    const prev = result[b ^ low]; // b without its lowest bit, already computed
    const coord = coords[31 - Math.clz32(low)];
    const anf = new Uint8Array(size);
    for (let u = 0; u < size; u++) anf[u] = prev[u] ^ coord[u];
    result.push(anf);
  }
  return result;
}

/**
 * Degree of a Boolean function given by its ANF (−1 for the zero function).
 * @param {Uint8Array} anf
 * @returns {number}
 */
export function anfDegree(anf) {
  let deg = -1;
  for (let u = 0; u < anf.length; u++) if (anf[u] && popcount(u) > deg) deg = popcount(u);
  return deg;
}

/**
 * Algebraic degree of the S-box (max over components) and the minimum degree over
 * all non-zero components. Low minimum degree helps higher-order differential,
 * integral and cube attacks.
 * @param {import('./sbox.js').SBox} s
 * @returns {{ degree: number, minComponentDegree: number, componentDegrees: number[] }}
 */
export function algebraicDegrees(s) {
  const anfs = componentAnfs(s);
  const componentDegrees = anfs.map(anfDegree);
  const nonZero = componentDegrees.slice(1);
  return {
    degree: Math.max(...nonZero),
    minComponentDegree: Math.min(...nonZero),
    componentDegrees,
  };
}

/**
 * Human-readable ANF, e.g. "x0x1 ⊕ x2 ⊕ 1". Bit i of the input is x_i.
 * @param {Uint8Array} anf
 * @returns {string}
 */
export function anfToString(anf) {
  const terms = [];
  for (let u = anf.length - 1; u >= 0; u--) {
    if (!anf[u]) continue;
    if (u === 0) {
      terms.push('1');
      continue;
    }
    let t = '';
    for (let i = 0; 1 << i <= u; i++) if (u & (1 << i)) t += `x${i}`;
    terms.push(t);
  }
  // Order by degree (descending), then lexicographically.
  terms.sort((p, q) => (q.match(/x/g)?.length ?? 0) - (p.match(/x/g)?.length ?? 0) || p.localeCompare(q));
  return terms.length ? terms.join(' ⊕ ') : '0';
}

/**
 * Rank of a GF(2) matrix whose rows are packed into 32-bit words.
 * @param {Uint32Array[]} rows  Modified in place.
 * @param {number} bits
 * @returns {number}
 */
function gf2Rank(rows, bits) {
  let rank = 0;
  for (let col = 0; col < bits && rank < rows.length; col++) {
    const w = col >>> 5;
    const mask = 1 << (col & 31);
    let pivot = -1;
    for (let r = rank; r < rows.length; r++) if (rows[r][w] & mask) { pivot = r; break; }
    if (pivot < 0) continue;
    [rows[rank], rows[pivot]] = [rows[pivot], rows[rank]];
    const p = rows[rank];
    for (let r = 0; r < rows.length; r++) {
      if (r !== rank && rows[r][w] & mask) {
        const row = rows[r];
        for (let k = w; k < row.length; k++) row[k] ^= p[k];
      }
    }
    rank++;
  }
  return rank;
}

/**
 * Number of linearly independent equations of degree ≤ 2 in the input bits x and
 * output bits y that hold for every (x, S(x)). More equations → easier algebraic
 * (XL / Gröbner) attacks. AES has 39, the reason for the XSL debate.
 * @param {import('./sbox.js').SBox} s
 * @returns {{ equations: number, monomials: number }}
 */
export function quadraticEquations(s) {
  const { n, m } = s;
  // Monomials over the 2n-ish variables z = (x_0..x_{n-1}, y_0..y_{m-1}) of degree ≤ 2.
  const vars = n + m;
  const monomials = 1 + vars + (vars * (vars - 1)) / 2;
  const words = Math.ceil(monomials / 32);
  /** @type {Uint32Array[]} */
  const rows = [];
  for (let x = 0; x < 1 << n; x++) {
    const z = x | (s.table[x] << n);
    const row = new Uint32Array(words);
    let k = 0;
    const set = (/** @type {boolean} */ bit) => {
      if (bit) row[k >>> 5] |= 1 << (k & 31);
      k++;
    };
    set(true); // constant
    for (let i = 0; i < vars; i++) set(((z >> i) & 1) === 1);
    for (let i = 0; i < vars; i++) for (let j = i + 1; j < vars; j++) set(((z >> i) & (z >> j) & 1) === 1);
    rows.push(row);
  }
  return { equations: monomials - gf2Rank(rows, monomials), monomials };
}

/**
 * Univariate interpolation polynomial of an n→n S-box over GF(2^n):
 * S(x) = Σ_k c_k x^k. Few terms or low degree enables interpolation attacks.
 * Depends on the chosen field polynomial, so it is not an affine invariant.
 * @param {import('./sbox.js').SBox} s
 * @param {number} [poly]  Field modulus (defaults per gf.js; AES polynomial for n = 8).
 * @returns {{ coefficients: Uint8Array, terms: number, degree: number }}
 */
export function interpolationPolynomial(s, poly) {
  if (s.n !== s.m || s.n < 2) throw new Error('Interpolation polynomial needs an n→n S-box with n ≥ 2');
  const f = getField(s.n, poly);
  const q = f.size;
  const c = new Uint8Array(q);
  c[0] = s.table[0];
  // c_k = Σ_{x≠0} S(x) · x^(q−1−k) for 1 ≤ k ≤ q−2;  c_{q−1} = Σ_x S(x).
  for (let x = 1; x < q; x++) {
    const y = s.table[x];
    c[q - 1] ^= y;
    if (!y) continue;
    let p = 1;
    for (let e = 1; e <= q - 2; e++) {
      p = f.mul(p, x);
      c[q - 1 - e] ^= f.mul(y, p);
    }
  }
  c[q - 1] ^= s.table[0];
  let terms = 0;
  let degree = -1;
  c.forEach((v, k) => {
    if (v) {
      terms++;
      degree = k;
    }
  });
  return { coefficients: c, terms, degree };
}
