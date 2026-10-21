import { compareToBaseline } from './baseline.js';

/**
 * Attack-oriented verdict: for each attack family, a level and a one-line reason.
 *
 * Grading principles (see the report for the rationale):
 * - Compare against the best value known for permutations of that size, then against
 *   10,000 random permutations of the same size ("better than X% of random").
 * - Judge relative to what is *typical for the size*: e.g. almost every 4-bit permutation
 *   has quadratic components, so that alone is a caution, not a weakness.
 * - SAC is judged by how far it deviates from ½ compared with random permutations,
 *   not by a percentile of the raw value (random S-boxes are all close to ½).
 * - Theoretical concerns without a known practical attack (quadratic equations, sparse
 *   interpolation polynomial) are cautions.
 * These verdicts describe the S-box in isolation; a cipher's security also depends on
 * its linear layer and number of rounds.
 *
 * @typedef {'strong' | 'caution' | 'weak' | 'na'} Level
 * @typedef {{ family: string, title: string, level: Level, value: string, reason: string }} FamilyVerdict
 */

/**
 * Best known values for n-bit permutations (δ minimal, NL maximal).
 * Odd n: Gold/Kasami APN permutations reach δ = 2 and NL = 2^(n−1) − 2^((n−1)/2).
 * n = 6: Dillon's APN permutation (δ = 2, NL = 24). n = 4, 8: δ = 4 (inversion / optimal classes).
 * @type {Record<number, { differentialUniformity: number, nonlinearity: number }>}
 */
export const BEST_KNOWN = {
  3: { differentialUniformity: 2, nonlinearity: 2 },
  4: { differentialUniformity: 4, nonlinearity: 4 },
  5: { differentialUniformity: 2, nonlinearity: 12 },
  6: { differentialUniformity: 2, nonlinearity: 24 },
  7: { differentialUniformity: 2, nonlinearity: 56 },
  8: { differentialUniformity: 4, nonlinearity: 112 },
};

/** @param {number} x */
const pct = (x) => `${Math.round(x * 100)}%`;

/**
 * @param {import('./baseline.js').BaselineComparison} cmp
 * @returns {string}
 */
export function beatsText(cmp) {
  if (cmp.betterThan === 1) return `better than all ${cmp.samples.toLocaleString('en-US')} random`;
  return `better than ${cmp.betterThan > 0.99 ? (cmp.betterThan * 100).toFixed(1) + '%' : pct(cmp.betterThan)} of random`;
}

/**
 * Grade a scalar metric against best-known values and the random baseline.
 * @param {import('./analyze.js').Analysis} a
 * @param {string} id
 * @param {number | null} value
 * @returns {{ level: Level, reason: string }}
 */
function gradeMetric(a, id, value) {
  const { n, m, bijective } = a.properties;
  if (value === null) return { level: 'na', reason: 'not defined for this S-box' };
  const best = bijective ? BEST_KNOWN[n]?.[/** @type {'differentialUniformity' | 'nonlinearity'} */ (id)] : undefined;
  if (best !== undefined && value === best) return { level: 'strong', reason: 'matches the best known value' };
  const cmp = n === m ? compareToBaseline(id, n, value) : null;
  if (!cmp) return { level: 'na', reason: `no random baseline for ${n}→${m}-bit S-boxes` };
  if (cmp.betterThan >= 0.99) return { level: 'strong', reason: beatsText(cmp) };
  if (cmp.percentile >= 0.4) return { level: 'caution', reason: `typical of a random S-box (${beatsText(cmp)})` };
  return { level: 'weak', reason: `worse than ${pct(1 - cmp.percentile)} of random S-boxes` };
}

/**
 * @param {import('./analyze.js').Analysis} a
 * @returns {FamilyVerdict[]}
 */
export function verdict(a) {
  const { n, m } = a.properties;
  const sameSize = n === m;
  /** @type {FamilyVerdict[]} */
  const out = [];

  const du = a.differential.uniformity;
  out.push({ family: 'differential', title: 'Differential', value: `δ = ${du}`, ...gradeMetric(a, 'differentialUniformity', du) });

  const nl = a.linear.nonlinearity;
  out.push({ family: 'linear', title: 'Linear', value: `NL = ${nl}`, ...gradeMetric(a, 'nonlinearity', nl) });

  const bu = a.boomerang.uniformity;
  out.push({
    family: 'boomerang',
    title: 'Boomerang',
    value: bu === null ? 'β undefined' : `β = ${bu}`,
    ...(bu === null ? { level: 'na', reason: 'only defined for permutations' } : gradeMetric(a, 'boomerangUniformity', bu)),
  });

  const ls = a.differentialLinear.linearStructures.length;
  const ai = a.differentialLinear.absoluteIndicator;
  let dl = gradeMetric(a, 'absoluteIndicator', ai);
  if (ls > 0) {
    const lsCmp = sameSize ? compareToBaseline('linearStructures', n, ls) : null;
    dl =
      lsCmp && lsCmp.percentile >= 0.4
        ? { level: 'caution', reason: `${ls} linear structures (common for ${n}-bit S-boxes)` }
        : { level: 'weak', reason: `${ls} linear structures — probability-1 relations (invariant-subspace risk)` };
  }
  out.push({ family: 'differential-linear', title: 'Differential-linear', value: `abs. indicator ${ai}`, ...dl });

  const minDeg = a.algebraic.minComponentDegree;
  const eqs = a.algebraic.quadratic.equations;
  const terms = a.algebraic.interpolation?.terms ?? null;
  /** @type {{ level: Level, reason: string }} */
  let alg;
  if (minDeg <= 2) {
    const degCmp = sameSize ? compareToBaseline('minComponentDegree', n, minDeg) : null;
    alg =
      degCmp && degCmp.equalTo + degCmp.betterThan < 0.5
        ? { level: 'weak', reason: `has components of degree ${minDeg} (higher-order differential / cube attacks)` }
        : { level: 'caution', reason: `components of degree ${minDeg} — typical for ${n}-bit S-boxes` };
  } else if (eqs > 0) {
    alg = { level: 'caution', reason: `${eqs} independent quadratic equations (XL / Gröbner concern)` };
  } else if (terms !== null && terms < (1 << n) / 8) {
    alg = { level: 'caution', reason: `sparse interpolation polynomial (${terms} terms)` };
  } else {
    alg = { level: 'strong', reason: 'no low-degree relations found' };
  }
  out.push({ family: 'algebraic', title: 'Algebraic / higher-order', value: `deg ${minDeg} · ${eqs} eq.`, ...alg });

  const fp = a.structure.fixedPoints.length;
  const ofp = a.structure.oppositeFixedPoints.length;
  /** @type {{ level: Level, reason: string }} */
  let st;
  if (!sameSize) st = { level: 'na', reason: 'fixed points need n = m' };
  else if (fp + ofp === 0) st = { level: 'strong', reason: a.properties.involution ? 'no fixed points (but an involution)' : 'no fixed or opposite fixed points' };
  else if (fp + ofp > Math.max(2, (1 << n) / 32)) st = { level: 'weak', reason: `${fp} fixed and ${ofp} opposite fixed points` };
  else st = { level: 'caution', reason: `${fp} fixed and ${ofp} opposite fixed point${fp + ofp > 1 ? 's' : ''}` };
  out.push({ family: 'structural', title: 'Structural', value: `${fp} fixed · ${ofp} opp.`, ...st });

  const sacMean = a.avalanche.sac.mean;
  const sacCmp = sameSize ? compareToBaseline('sacMean', n, sacMean) : null;
  /** @type {{ level: Level, reason: string }} */
  let av;
  if (!sacCmp) {
    const dev = Math.abs(sacMean - 0.5);
    av = dev <= 0.05 ? { level: 'strong', reason: `mean within ${dev.toFixed(3)} of ½` } : { level: 'caution', reason: `mean ${dev.toFixed(3)} away from ½` };
  } else {
    // Share of random permutations that deviate from ½ strictly less than this one.
    const tail = 1 - sacCmp.betterThan - sacCmp.equalTo;
    av =
      tail <= 0.95
        ? { level: 'strong', reason: `deviation from ½ is within the normal range for ${n}-bit S-boxes` }
        : tail <= 0.995
          ? { level: 'caution', reason: `larger SAC deviation than ${pct(tail)} of random S-boxes` }
          : { level: 'weak', reason: `larger SAC deviation than ${(tail * 100).toFixed(1)}% of random S-boxes` };
  }
  out.push({ family: 'avalanche', title: 'Avalanche', value: `SAC = ${sacMean.toFixed(4)}`, ...av });

  return out;
}
