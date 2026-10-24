import { algebraicDegrees, quadraticEquations } from './algebraic.js';
import { dlct } from './connectivity.js';
import { ddt, differentialSpectrum } from './differential.js';
import { walsh, walshSpectrum } from './linear.js';
import { spectrum } from './matrix.js';
import { createSBox, isBijective } from './sbox.js';

/**
 * Affine equivalence of S-boxes.
 *
 * S₁ and S₂ are affine equivalent when S₂ = B ∘ S₁ ∘ A for affine bijections A, B.
 * Affine-equivalent S-boxes share every affine-invariant property (δ, NL, β, degree, …),
 * so an S-box that is "AES in disguise" is no stronger than AES — and no weaker.
 *
 * Method (Biryukov, De Cannière, Braeken, Preneel, EUROCRYPT 2003):
 *  1. Compare cheap affine invariants; any difference proves non-equivalence.
 *  2. Linear equivalence (LE): guess A on one point, then propagate. Every known pair
 *     x ↦ A(x) gives B(S₁(A(x))) = S₂(x), every known pair u ↦ B(u) gives
 *     A(S₂⁻¹(B(u))) = S₁⁻¹(u), and each new pair is closed under linearity. Contradictions
 *     (inconsistent or non-injective maps) prune the guess; otherwise guess again.
 *  3. Affine equivalence: with S₁ₐ(x) = S₁(x ⊕ a) ⊕ S₁(a) and S₂'(x) = S₂(x) ⊕ S₂(0), the
 *     S-boxes are affine equivalent iff S₂' is linearly equivalent to S₁ₐ for some a.
 */

/**
 * @typedef {import('./generators.js').AffineMap} AffineMap
 * @typedef {{ A: Int16Array, B: Int16Array }} LinearSolution  Lookup tables of the linear maps.
 */

/**
 * Find linear bijections A, B with t2 = B ∘ t1 ∘ A, where t1(0) = t2(0) = 0.
 * @param {ArrayLike<number>} t1  Permutation.
 * @param {ArrayLike<number>} t2  Permutation.
 * @param {{ shouldStop?: () => boolean }} [opts]
 * @returns {LinearSolution | null}
 */
export function linearEquivalence(t1, t2, opts = {}) {
  const N = t1.length;
  if (t2.length !== N || t1[0] !== 0 || t2[0] !== 0) return null;
  const inv1 = new Int16Array(N);
  const inv2 = new Int16Array(N);
  for (let x = 0; x < N; x++) {
    inv1[t1[x]] = x;
    inv2[t2[x]] = x;
  }

  // For each map: image table, inverse table (−1 = unknown) and the list of points in the
  // known span (append-only, so backtracking just truncates it).
  const img = [new Int16Array(N).fill(-1), new Int16Array(N).fill(-1)];
  const pre = [new Int16Array(N).fill(-1), new Int16Array(N).fill(-1)];
  const span = [new Int16Array(N), new Int16Array(N)];
  const count = [1, 1];
  for (const k of [0, 1]) {
    img[k][0] = 0;
    pre[k][0] = 0;
  }
  const qKind = new Uint8Array(4 * N);
  const qX = new Int16Array(4 * N);
  const qY = new Int16Array(4 * N);
  const stop = opts.shouldStop ?? (() => false);
  let steps = 0;

  /**
   * Record x ↦ y for map k (0 = A, 1 = B), extending by linearity and queueing the
   * consequences. Returns false on contradiction.
   * @param {number} k @param {number} x @param {number} y
   * @param {{ head: number, tail: number }} q
   */
  function add(k, x, y, q) {
    const im = img[k];
    if (im[x] !== -1) return im[x] === y;
    const pr = pre[k];
    if (pr[y] !== -1) return false; // y already has a different preimage: not injective
    const sp = span[k];
    const c = count[k];
    // x is outside the current span: the span doubles to span ∪ (span ⊕ x).
    for (let i = 0; i < c; i++) {
      const p = sp[i];
      const np = p ^ x;
      const nq = im[p] ^ y;
      im[np] = nq;
      pr[nq] = np;
      sp[c + i] = np;
      const t = q.tail++;
      if (k === 0) {
        qKind[t] = 1; // A: np ↦ nq  ⇒  B: t1(nq) ↦ t2(np)
        qX[t] = t1[nq];
        qY[t] = t2[np];
      } else {
        qKind[t] = 0; // B: np ↦ nq  ⇒  A: t2⁻¹(nq) ↦ t1⁻¹(np)
        qX[t] = inv2[nq];
        qY[t] = inv1[np];
      }
    }
    count[k] = 2 * c;
    return true;
  }

  /** @param {number} ca @param {number} cb  Roll both maps back to these span sizes. */
  function rollback(ca, cb) {
    /** @type {[number, number]} */
    const target = [ca, cb];
    for (const k of [0, 1]) {
      for (let i = count[k] - 1; i >= target[k]; i--) {
        const p = span[k][i];
        pre[k][img[k][p]] = -1;
        img[k][p] = -1;
      }
      count[k] = target[k];
    }
  }

  /**
   * Apply a guess for A and propagate all consequences.
   * @param {number} x @param {number} y
   */
  function propagate(x, y) {
    const q = { head: 0, tail: 0 };
    if (!add(0, x, y, q)) return false;
    while (q.head < q.tail) {
      const h = q.head++;
      if (!add(qKind[h], qX[h], qY[h], q)) return false;
      // The queue only grows while spans grow, so it is bounded by 2N entries per map;
      // compact it when the head catches up to keep indices small.
      if (q.head === q.tail) q.head = q.tail = 0;
    }
    return true;
  }

  /** @returns {boolean} */
  function solve() {
    if (count[0] === N) return true;
    if (++steps % 1024 === 0 && stop()) return false;
    let x = 1;
    while (img[0][x] !== -1) x++;
    const ca = count[0];
    const cb = count[1];
    for (let y = 1; y < N; y++) {
      if (pre[0][y] !== -1) continue;
      if (propagate(x, y) && solve()) return true;
      rollback(ca, cb);
    }
    return false;
  }

  if (!solve() || count[0] !== N || count[1] !== N) return null;
  // Verify (cheap, and guards against any propagation bug).
  for (let x = 0; x < N; x++) if (img[1][t1[img[0][x]]] !== t2[x]) return null;
  return { A: img[0].slice(), B: img[1].slice() };
}

/**
 * Bit-matrix rows (see generators.js) of a linear map given as a lookup table.
 * @param {ArrayLike<number>} table
 * @param {number} n
 * @returns {number[]}
 */
export function tableToMatrix(table, n) {
  return Array.from({ length: n }, (_, i) => {
    let row = 0;
    for (let j = 0; j < n; j++) if ((table[1 << j] >> i) & 1) row |= 1 << j;
    return row;
  });
}

/**
 * Affine-invariant fingerprint used to reject non-equivalent pairs cheaply.
 * @param {import('./sbox.js').SBox} s
 * @returns {[string, string][]}  [property name, canonical value] pairs.
 */
export function invariantFingerprint(s) {
  const d = ddt(s);
  const w = walsh(s);
  const degrees = algebraicDegrees(s).componentDegrees.slice(1).sort((a, b) => a - b);
  /** @param {Map<number, number>} m */
  const str = (m) => [...m].map(([v, c]) => `${v}:${c}`).join(',');
  return [
    ['differential spectrum', str(differentialSpectrum(d))],
    ['Walsh spectrum', str(walshSpectrum(w))],
    ['component degrees', degrees.join(',')],
    ['quadratic equations', String(quadraticEquations(s).equations)],
    ['DLCT spectrum', str(spectrum(dlct(d), { skipRow0: true, skipCol0: true, abs: true }))],
  ];
}

/**
 * @typedef {(
 *   { status: 'equivalent', A: AffineMap, B: AffineMap, constantsTried: number } |
 *   { status: 'not-equivalent', reason: string, invariant: string | null } |
 *   { status: 'incompatible', reason: string } |
 *   { status: 'cancelled' }
 * )} EquivalenceResult
 */

/**
 * Decide whether s2 = B ∘ s1 ∘ A for affine bijections A, B, returning the maps if so.
 * @param {import('./sbox.js').SBox} s1
 * @param {import('./sbox.js').SBox} s2
 * @param {{
 *   onProgress?: (done: number, total: number) => void,
 *   shouldStop?: () => boolean,
 *   fingerprints?: [[string, string][], [string, string][]],
 * }} [opts]
 * @returns {EquivalenceResult}
 */
export function affineEquivalence(s1, s2, opts = {}) {
  if (s1.n !== s2.n || s1.m !== s2.m) return { status: 'incompatible', reason: 'different sizes' };
  if (!isBijective(s1) || !isBijective(s2)) return { status: 'incompatible', reason: 'both S-boxes must be permutations' };

  const [f1, f2] = opts.fingerprints ?? [invariantFingerprint(s1), invariantFingerprint(s2)];
  for (let i = 0; i < f1.length; i++) {
    if (f1[i][1] !== f2[i][1]) return { status: 'not-equivalent', reason: `their ${f1[i][0]} differs`, invariant: f1[i][0] };
  }

  const N = 1 << s1.n;
  const t1 = s1.table;
  const t2 = s2.table;
  const n2 = Uint8Array.from(t2, (y) => y ^ t2[0]); // S₂'(x) = S₂(x) ⊕ S₂(0)
  const shifted = new Uint8Array(N);
  const stop = opts.shouldStop ?? (() => false);
  for (let a = 0; a < N; a++) {
    if (stop()) return { status: 'cancelled' };
    for (let x = 0; x < N; x++) shifted[x] = t1[x ^ a] ^ t1[a]; // S₁ₐ
    const sol = linearEquivalence(shifted, n2, { shouldStop: stop });
    opts.onProgress?.(a + 1, N);
    if (sol) {
      const LA = tableToMatrix(sol.A, s1.n);
      const LB = tableToMatrix(sol.B, s1.n);
      // s2(x) = LB · s1(LA·x ⊕ a) ⊕ (LB · s1(a) ⊕ s2(0))
      return {
        status: 'equivalent',
        A: { matrix: LA, constant: a },
        B: { matrix: LB, constant: sol.B[t1[a]] ^ t2[0] },
        constantsTried: a + 1,
      };
    }
  }
  if (stop()) return { status: 'cancelled' };
  return { status: 'not-equivalent', reason: 'exhaustive search found no affine maps', invariant: null };
}

/* ------------------------------------------------------------------ */
/* 4-bit optimal classes (Leander & Poschmann, WAIFI 2007)             */
/* ------------------------------------------------------------------ */

/**
 * Representatives of the 16 affine equivalence classes of optimal 4-bit S-boxes
 * (δ = 4, NL = 4), as listed by Leander & Poschmann, "On the Classification of 4 Bit
 * S-boxes". Every optimal 4-bit permutation is affine equivalent to exactly one of them.
 */
// prettier-ignore
export const OPTIMAL_4BIT_CLASSES = [
  [0, 1, 2, 13, 4, 7, 15, 6, 8, 11, 12, 9, 3, 14, 10, 5],
  [0, 1, 2, 13, 4, 7, 15, 6, 8, 11, 14, 3, 5, 9, 10, 12],
  [0, 1, 2, 13, 4, 7, 15, 6, 8, 11, 14, 3, 10, 12, 5, 9],
  [0, 1, 2, 13, 4, 7, 15, 6, 8, 12, 5, 3, 10, 14, 11, 9],
  [0, 1, 2, 13, 4, 7, 15, 6, 8, 12, 9, 11, 10, 14, 5, 3],
  [0, 1, 2, 13, 4, 7, 15, 6, 8, 12, 11, 9, 10, 14, 3, 5],
  [0, 1, 2, 13, 4, 7, 15, 6, 8, 12, 11, 9, 10, 14, 5, 3],
  [0, 1, 2, 13, 4, 7, 15, 6, 8, 12, 14, 11, 10, 9, 3, 5],
  [0, 1, 2, 13, 4, 7, 15, 6, 8, 14, 9, 5, 10, 11, 3, 12],
  [0, 1, 2, 13, 4, 7, 15, 6, 8, 14, 11, 3, 5, 9, 10, 12],
  [0, 1, 2, 13, 4, 7, 15, 6, 8, 14, 11, 5, 10, 9, 3, 12],
  [0, 1, 2, 13, 4, 7, 15, 6, 8, 14, 11, 10, 5, 9, 12, 3],
  [0, 1, 2, 13, 4, 7, 15, 6, 8, 14, 11, 10, 9, 3, 12, 5],
  [0, 1, 2, 13, 4, 7, 15, 6, 8, 14, 12, 9, 5, 11, 10, 3],
  [0, 1, 2, 13, 4, 7, 15, 6, 8, 14, 12, 11, 3, 9, 5, 10],
  [0, 1, 2, 13, 4, 7, 15, 6, 8, 14, 12, 11, 9, 3, 10, 5],
].map((t) => createSBox(t, 4));

/**
 * @typedef {(
 *   { status: 'optimal', index: number, label: string, A: AffineMap, B: AffineMap } |
 *   { status: 'not-optimal', reason: string } |
 *   { status: 'not-applicable', reason: string }
 * )} ClassResult
 */

/**
 * Identify the Leander–Poschmann class G0…G15 of a 4-bit permutation.
 * Returns maps with s = B ∘ G_i ∘ A.
 * @param {import('./sbox.js').SBox} s
 * @param {{ uniformity: number, nonlinearity: number }} [known]  Precomputed δ and NL.
 * @returns {ClassResult}
 */
export function optimalClass4(s, known) {
  if (s.n !== 4 || s.m !== 4 || !isBijective(s)) return { status: 'not-applicable', reason: 'only defined for 4-bit permutations' };
  const du = known?.uniformity ?? Math.max(...spectrumKeys(differentialSpectrum(ddt(s))));
  const nl = known?.nonlinearity ?? 8 - Math.max(...spectrumKeys(walshSpectrum(walsh(s)))) / 2;
  if (du !== 4 || nl !== 4) return { status: 'not-optimal', reason: `optimal needs δ = 4 and NL = 4 (this has δ = ${du}, NL = ${nl})` };
  const fp = invariantFingerprint(s);
  for (let i = 0; i < OPTIMAL_4BIT_CLASSES.length; i++) {
    const r = affineEquivalence(OPTIMAL_4BIT_CLASSES[i], s, { fingerprints: [fingerprintCache(i), fp] });
    if (r.status === 'equivalent') return { status: 'optimal', index: i, label: `G${i}`, A: r.A, B: r.B };
  }
  // Unreachable if the representative table is complete (guarded by tests).
  return { status: 'not-optimal', reason: 'matches no known optimal class' };
}

/** @param {Map<number, number>} m */
function spectrumKeys(m) {
  return [...m.keys()];
}

/** @type {[string, string][][]} */
const fpCache = [];
/** @param {number} i */
function fingerprintCache(i) {
  return (fpCache[i] ??= invariantFingerprint(OPTIMAL_4BIT_CLASSES[i]));
}
