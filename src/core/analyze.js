import { algebraicDegrees, interpolationPolynomial, quadraticEquations } from './algebraic.js';
import { avalancheWeights, bic, sac } from './avalanche.js';
import { absoluteIndicator, bct, boomerangUniformity, dlct } from './connectivity.js';
import { ddt, differentialBranchNumber, differentialSpectrum, differentialUniformity } from './differential.js';
import { componentNonlinearities, lat, linearBranchNumber, linearity, nonlinearity, walsh, walshSpectrum } from './linear.js';
import { isBalanced, isBijective } from './sbox.js';
import { cycleStructure, fixedPoints, isInvolution, linearStructures, oppositeFixedPoints } from './structure.js';

/**
 * Run `fn`, recording its duration in `timings[name]` (milliseconds).
 * @template T
 * @param {Record<string, number>} timings
 * @param {string} name
 * @param {() => T} fn
 * @returns {T}
 */
function timed(timings, name, fn) {
  const start = performance.now();
  const result = fn();
  timings[name] = performance.now() - start;
  return result;
}

/**
 * Full analysis of an S-box: every table and metric the toolkit knows about.
 * Takes ~50 ms for an 8-bit S-box (BCT dominates).
 * @param {import('./sbox.js').SBox} s
 */
export function analyze(s) {
  /** @type {Record<string, number>} */
  const timings = {};
  const size = 1 << s.n;

  const ddtTable = timed(timings, 'ddt', () => ddt(s));
  const walshTable = timed(timings, 'walsh', () => walsh(s));
  const latTable = lat(s, walshTable);
  const bctTable = timed(timings, 'bct', () => bct(s));
  const dlctTable = timed(timings, 'dlct', () => dlct(ddtTable));
  const componentNl = componentNonlinearities(walshTable);

  const lin = linearity(walshTable);
  const du = differentialUniformity(ddtTable);

  return {
    sbox: s,
    properties: {
      n: s.n,
      m: s.m,
      bijective: isBijective(s),
      balanced: isBalanced(s),
      involution: isInvolution(s),
    },
    tables: { ddt: ddtTable, lat: latTable, walsh: walshTable, bct: bctTable, dlct: dlctTable },
    differential: {
      uniformity: du,
      maxProbability: du / size,
      spectrum: differentialSpectrum(ddtTable),
      branchNumber: timed(timings, 'diffBranch', () => differentialBranchNumber(s)),
    },
    linear: {
      nonlinearity: nonlinearity(walshTable),
      linearity: lin,
      maxCorrelation: lin / size,
      maxBias: lin / (2 * size),
      spectrum: walshSpectrum(walshTable),
      branchNumber: linearBranchNumber(walshTable),
      componentNonlinearities: componentNl,
    },
    boomerang: {
      uniformity: bctTable ? boomerangUniformity(bctTable) : null,
    },
    differentialLinear: {
      absoluteIndicator: absoluteIndicator(dlctTable),
      linearStructures: linearStructures(dlctTable),
    },
    algebraic: {
      ...timed(timings, 'degree', () => algebraicDegrees(s)),
      quadratic: timed(timings, 'quadratic', () => quadraticEquations(s)),
      interpolation:
        s.n === s.m && s.n >= 2 ? timed(timings, 'interpolation', () => interpolationPolynomial(s)) : null,
    },
    avalanche: {
      sac: timed(timings, 'sac', () => sac(s)),
      bic: timed(timings, 'bic', () => bic(s, componentNl)),
      weights: avalancheWeights(s),
    },
    structure: {
      fixedPoints: fixedPoints(s),
      oppositeFixedPoints: oppositeFixedPoints(s),
      cycles: cycleStructure(s),
    },
    timings,
  };
}

/** @typedef {ReturnType<typeof analyze>} Analysis */
