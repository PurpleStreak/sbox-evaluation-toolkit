import { dot } from './bits.js';
import { ddt } from './differential.js';
import { walsh } from './linear.js';
import { createRng, randomInt } from './random.js';
import { createSBox, isBijective } from './sbox.js';
import { randomPermutation } from './generators.js';

/**
 * @typedef {object} SearchOptions
 * @property {number} n                    Width of the permutation (3..8).
 * @property {number} seed
 * @property {import('./sbox.js').SBox} [start]  Starting permutation (random if omitted).
 * @property {number} [iterations]         Total moves (default 20 000).
 * @property {number} [initialTemperature] Default: calibrated so a typical uphill move
 *                                         is accepted with probability ~1/e.
 * @property {number} [finalTemperature]   Default: initialTemperature / 1000; geometric
 *                                         cooling in between.
 * @property {number} [linearWeight]       Weight of the Walsh term (default 1).
 * @property {number} [differentialWeight] Weight of the DDT term (default 1).
 */

/**
 * @typedef {object} SearchStats
 * @property {number} iteration
 * @property {number} iterations
 * @property {number} temperature
 * @property {number} accepted
 * @property {{ nonlinearity: number, uniformity: number, cost: number }} current
 * @property {{ nonlinearity: number, uniformity: number, cost: number }} best
 */

/**
 * Simulated-annealing search for permutations with high nonlinearity and low
 * differential uniformity.
 *
 * Moves swap two outputs (so the S-box stays bijective). Instead of recomputing
 * the tables, each move touches only the 2^(2n−2) Walsh cells and O(2^(n+2)) DDT
 * cells it can change: the Walsh cost change is evaluated read-only and written
 * back only for accepted moves (most are rejected). Value histograms give the
 * current NL/δ in O(2^n). An 8-bit move costs ~16k cell updates (~0.3 ms).
 *
 * Cost (lower is better), in the spirit of Clark, Jacob & Stepney (2005):
 *   wL · Σ_{|W| > X_L} (|W| − X_L)^3  +  wD · Σ_{D > X_D} (D − X_D)^3
 * where X_L / X_D are the best values achievable in theory, so the cost pushes on
 * the whole tail of each spectrum rather than on its maximum alone.
 *
 * @param {SearchOptions} opts
 */
export function createSearch(opts) {
  const { n, seed } = opts;
  if (n < 3 || n > 8) throw new Error('Search supports 3..8-bit permutations');
  const size = 1 << n;
  const iterations = opts.iterations ?? 20000;
  const wL = opts.linearWeight ?? 1;
  const wD = opts.differentialWeight ?? 1;
  const rng = createRng(seed ^ 0x9e3779b9);

  const startBox = opts.start ?? randomPermutation(n, seed);
  if (startBox.n !== n || !isBijective(startBox)) throw new Error('Start S-box must be an n-bit permutation');
  const t = Uint8Array.from(startBox.table);

  // Walsh stored column-major (W[b * size + a]) so a move touches contiguous memory.
  const w0 = walsh(startBox);
  const W = new Int32Array(size * size);
  for (let a = 0; a < size; a++) for (let b = 0; b < size; b++) W[b * size + a] = w0.data[a * size + b];
  const D = Int32Array.from(ddt(startBox).data);

  // Histograms over the non-trivial parts: |W| for b ≠ 0, DDT values for a ≠ 0.
  const histW = new Int32Array(size + 1);
  const histD = new Int32Array(size + 1);
  for (let b = 1; b < size; b++) for (let a = 0; a < size; a++) histW[Math.abs(W[b * size + a])]++;
  for (let i = size; i < D.length; i++) histD[D[i]]++;

  // Theoretical floors: |W| ≥ 2^(n/2) (bent bound), δ ≥ 2 (APN). Per-cell penalty
  // g(v) = (v − floor)^3 above the floor, so the cost is a sum over table cells and
  // a move's cost change can be computed from the cells it touches.
  const xL = 1 << Math.ceil(n / 2);
  const xD = 2;
  const gW = Float64Array.from({ length: size + 1 }, (_, v) => (v > xL ? (v - xL) ** 3 : 0));
  const gD = Float64Array.from({ length: size + 1 }, (_, v) => (v > xD ? (v - xD) ** 3 : 0));

  let sumW = 0;
  let sumD = 0;
  for (let v = 0; v <= size; v++) {
    sumW += histW[v] * gW[v];
    sumD += histD[v] * gD[v];
  }
  // Normalise both terms to their starting magnitude so the weights are comparable.
  const normL = sumW || 1;
  const normD = sumD || 1;
  const cost = () => (wL * sumW) / normL + (wD * sumD) / normD;

  /** @param {Int32Array} hist */
  const top = (hist) => {
    for (let v = hist.length - 1; v > 0; v--) if (hist[v]) return v;
    return 0;
  };

  // Walsh cells affected by swapping the outputs at x1, x2 (filled by prepareWalsh):
  // W[a][b] changes only when b·y1 ≠ b·y2 (the terms at x1 and x2 flip sign) and
  // a·x1 ≠ a·x2 (otherwise the flips cancel). It then moves by +4 if the old term
  // at x1, (−1)^(b·y1 ⊕ a·x1), was −1, and by −4 otherwise.
  const rowsA = new Int32Array(size);
  const signA = new Uint8Array(size);
  const colsB = new Int32Array(size);
  const signB = new Uint8Array(size);
  let na = 0;
  let nb = 0;

  /**
   * @param {number} x1
   * @param {number} x2
   */
  function prepareWalsh(x1, x2) {
    const ax = x1 ^ x2;
    const dy = t[x1] ^ t[x2];
    na = 0;
    nb = 0;
    for (let v = 0; v < size; v++) {
      if (dot(v, ax)) {
        rowsA[na] = v;
        signA[na++] = dot(v, x1);
      }
      if (v && dot(v, dy)) {
        colsB[nb] = v * size;
        signB[nb++] = dot(v, t[x1]);
      }
    }
  }

  /** Change in sumW for the prepared swap, without modifying anything. */
  function walshDelta() {
    // Locals (not closure variables) keep this hot loop fast in V8.
    const cntA = na;
    const cntB = nb;
    const w = W;
    const g = gW;
    const ra = rowsA;
    const sa = signA;
    let delta = 0;
    for (let j = 0; j < cntB; j++) {
      const base = colsB[j];
      const p = signB[j];
      for (let k = 0; k < cntA; k++) {
        const old = w[base + ra[k]];
        const next = p ^ sa[k] ? old + 4 : old - 4;
        delta += g[next < 0 ? -next : next] - g[old < 0 ? -old : old];
      }
    }
    return delta;
  }

  /** Apply the prepared swap to W and its histogram. */
  function applyWalsh() {
    for (let j = 0; j < nb; j++) {
      const base = colsB[j];
      const p = signB[j];
      for (let k = 0; k < na; k++) {
        const i = base + rowsA[k];
        const old = W[i];
        const next = p ^ signA[k] ? old + 4 : old - 4;
        histW[old < 0 ? -old : old]--;
        histW[next < 0 ? -next : next]++;
        W[i] = next;
      }
    }
  }

  /**
   * @param {number} i
   * @param {number} sign
   */
  const bumpD = (i, sign) => {
    const old = D[i];
    histD[old]--;
    histD[old + sign]++;
    sumD += gD[old + sign] - gD[old];
    D[i] = old + sign;
  };

  /**
   * Swap t[x1] and t[x2] and update the DDT (only pairs involving x1 or x2 change).
   * Self-inverse. Does not touch W.
   * @param {number} x1
   * @param {number} x2
   */
  function swapTableAndDdt(x1, x2) {
    const dx = x1 ^ x2;
    /** @param {number} sign */
    const touch = (sign) => {
      for (let a = 1; a < size; a++) {
        const row = a * size;
        bumpD(row + (t[x1] ^ t[x1 ^ a]), sign);
        bumpD(row + (t[x2] ^ t[x2 ^ a]), sign);
        if (a !== dx) {
          bumpD(row + (t[x1 ^ a] ^ t[x1]), sign);
          bumpD(row + (t[x2 ^ a] ^ t[x2]), sign);
        }
      }
    };
    touch(-1);
    const y = t[x1];
    t[x1] = t[x2];
    t[x2] = y;
    touch(+1);
  }

  let current = cost();

  /**
   * Evaluate swapping x1, x2: returns the cost change and leaves the DDT/table swapped
   * (call commit() or rollback() next).
   * @param {number} x1
   * @param {number} x2
   */
  function propose(x1, x2) {
    prepareWalsh(x1, x2);
    const dW = walshDelta();
    const before = sumD;
    swapTableAndDdt(x1, x2);
    return (wL * dW) / normL + (wD * (sumD - before)) / normD;
  }

  /** @param {number} delta */
  function commit(delta) {
    applyWalsh();
    current += delta;
  }

  // Calibrate the temperature scale from the mean uphill cost change of sample moves.
  let t0 = opts.initialTemperature ?? 0;
  if (!t0) {
    let sum = 0;
    let uphill = 0;
    for (let k = 0; k < 64; k++) {
      const x1 = randomInt(rng, size);
      const x2 = (x1 + 1 + randomInt(rng, size - 1)) % size;
      const delta = propose(x1, x2);
      swapTableAndDdt(x1, x2);
      if (delta > 0) {
        sum += delta;
        uphill++;
      }
    }
    t0 = uphill ? sum / uphill : 1;
  }
  const t1 = opts.finalTemperature ?? t0 / 1000;

  let iteration = 0;
  let accepted = 0;
  let temperature = t0;
  const cooling = Math.pow(t1 / t0, 1 / Math.max(1, iterations));

  const stats = () => ({ nonlinearity: size / 2 - top(histW) / 2, uniformity: top(histD), cost: current });
  let best = stats();
  let bestTable = Uint8Array.from(t);

  /** @param {{ nonlinearity: number, uniformity: number, cost: number }} s */
  const better = (s) =>
    s.nonlinearity > best.nonlinearity ||
    (s.nonlinearity === best.nonlinearity &&
      (s.uniformity < best.uniformity || (s.uniformity === best.uniformity && s.cost < best.cost)));

  return {
    /**
     * Run up to `count` more moves.
     * @param {number} count
     * @returns {SearchStats}
     */
    step(count) {
      const end = Math.min(iterations, iteration + count);
      for (; iteration < end; iteration++) {
        const x1 = randomInt(rng, size);
        let x2 = randomInt(rng, size - 1);
        if (x2 >= x1) x2++;
        const delta = propose(x1, x2);
        if (delta <= 0 || rng() < Math.exp(-delta / temperature)) {
          commit(delta);
          accepted++;
          const s = stats();
          if (better(s)) {
            best = s;
            bestTable = Uint8Array.from(t);
          }
        } else {
          swapTableAndDdt(x1, x2); // roll back
        }
        temperature *= cooling;
      }
      return this.stats();
    },

    /** @returns {SearchStats} */
    stats() {
      return { iteration, iterations, temperature, accepted, current: stats(), best };
    },

    get done() {
      return iteration >= iterations;
    },

    /** Best permutation found so far. */
    bestSBox() {
      return createSBox(bestTable, n);
    },

    /** Current permutation (for consistency checks). */
    currentSBox() {
      return createSBox(t, n);
    },
  };
}
