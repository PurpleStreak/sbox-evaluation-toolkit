/**
 * Catalogue of scalar metrics: how to read each one from an {@link Analysis},
 * which attack it relates to, which direction is better, and whether it is
 * invariant under affine equivalence (S ↦ B∘S∘A ⊕ c with A, B affine bijections).
 *
 * Affine-invariant metrics describe the whole equivalence class; the others can be
 * changed by a cheap affine re-encoding and should not be over-interpreted.
 *
 * @typedef {import('./analyze.js').Analysis} Analysis
 *
 * @typedef {'differential' | 'linear' | 'boomerang' | 'differential-linear' | 'algebraic' | 'interpolation' | 'avalanche' | 'structural'} AttackFamily
 *
 * @typedef {object} MetricDef
 * @property {string} id
 * @property {string} label
 * @property {AttackFamily} family
 * @property {'lower' | 'higher' | 'closer-to-half' | 'none'} better
 * @property {boolean} affineInvariant
 * @property {string} description
 * @property {(a: Analysis) => number | null} get
 */

/** @type {MetricDef[]} */
export const METRICS = [
  {
    id: 'differentialUniformity',
    label: 'Differential uniformity δ',
    family: 'differential',
    better: 'lower',
    affineInvariant: true,
    description: 'Largest non-trivial DDT entry; max differential probability is δ/2ⁿ.',
    get: (a) => a.differential.uniformity,
  },
  {
    id: 'differentialBranchNumber',
    label: 'Differential branch number',
    family: 'differential',
    better: 'higher',
    affineInvariant: false,
    description: 'Min of wt(Δin) + wt(Δout) over all input pairs.',
    get: (a) => a.differential.branchNumber,
  },
  {
    id: 'nonlinearity',
    label: 'Nonlinearity NL',
    family: 'linear',
    better: 'higher',
    affineInvariant: true,
    description: 'Distance of the closest component function to an affine function.',
    get: (a) => a.linear.nonlinearity,
  },
  {
    id: 'maxBias',
    label: 'Max linear bias',
    family: 'linear',
    better: 'lower',
    affineInvariant: true,
    description: 'Largest |Pr[a·x = b·S(x)] − ½| over non-trivial masks.',
    get: (a) => a.linear.maxBias,
  },
  {
    id: 'linearBranchNumber',
    label: 'Linear branch number',
    family: 'linear',
    better: 'higher',
    affineInvariant: false,
    description: 'Min of wt(a) + wt(b) over masks with non-zero correlation.',
    get: (a) => a.linear.branchNumber,
  },
  {
    id: 'boomerangUniformity',
    label: 'Boomerang uniformity β',
    family: 'boomerang',
    better: 'lower',
    affineInvariant: true,
    description: 'Largest non-trivial BCT entry (permutations only); β ≥ δ.',
    get: (a) => a.boomerang.uniformity,
  },
  {
    id: 'absoluteIndicator',
    label: 'Absolute indicator',
    family: 'differential-linear',
    better: 'lower',
    affineInvariant: true,
    description: 'Largest non-trivial autocorrelation |ACT| = 2·|DLCT|.',
    get: (a) => a.differentialLinear.absoluteIndicator,
  },
  {
    id: 'linearStructures',
    label: 'Linear structures',
    family: 'structural',
    better: 'lower',
    affineInvariant: true,
    description: 'Pairs (a, b) whose derivative b·(S(x) ⊕ S(x⊕a)) is constant.',
    get: (a) => a.differentialLinear.linearStructures.length,
  },
  {
    id: 'degree',
    label: 'Algebraic degree',
    family: 'algebraic',
    better: 'higher',
    affineInvariant: true,
    description: 'Highest degree of any component in algebraic normal form.',
    get: (a) => a.algebraic.degree,
  },
  {
    id: 'minComponentDegree',
    label: 'Min component degree',
    family: 'algebraic',
    better: 'higher',
    affineInvariant: true,
    description: 'Lowest degree among all non-zero components b·S.',
    get: (a) => a.algebraic.minComponentDegree,
  },
  {
    id: 'quadraticEquations',
    label: 'Quadratic equations',
    family: 'algebraic',
    better: 'lower',
    affineInvariant: true,
    description: 'Independent equations of degree ≤ 2 in (x, S(x)).',
    get: (a) => a.algebraic.quadratic.equations,
  },
  {
    id: 'interpolationTerms',
    label: 'Interpolation terms',
    family: 'interpolation',
    better: 'higher',
    affineInvariant: false,
    description: 'Non-zero coefficients of the univariate polynomial over GF(2ⁿ).',
    get: (a) => a.algebraic.interpolation?.terms ?? null,
  },
  {
    id: 'sacMean',
    label: 'SAC (mean)',
    family: 'avalanche',
    better: 'closer-to-half',
    affineInvariant: false,
    description: 'Average probability that an output bit flips when one input bit flips.',
    get: (a) => a.avalanche.sac.mean,
  },
  {
    id: 'bicNl',
    label: 'BIC-NL (min)',
    family: 'avalanche',
    better: 'higher',
    affineInvariant: false,
    description: 'Lowest nonlinearity of f_j ⊕ f_k over output-bit pairs.',
    get: (a) => (Number.isNaN(a.avalanche.bic.nl.min) ? null : a.avalanche.bic.nl.min),
  },
  {
    id: 'bicSac',
    label: 'BIC-SAC (mean)',
    family: 'avalanche',
    better: 'closer-to-half',
    affineInvariant: false,
    description: 'Average SAC of f_j ⊕ f_k over output-bit pairs.',
    get: (a) => (Number.isNaN(a.avalanche.bic.sac.mean) ? null : a.avalanche.bic.sac.mean),
  },
  {
    id: 'fixedPoints',
    label: 'Fixed points',
    family: 'structural',
    better: 'lower',
    affineInvariant: false,
    description: 'Inputs with S(x) = x.',
    get: (a) => a.structure.fixedPoints.length,
  },
  {
    id: 'oppositeFixedPoints',
    label: 'Opposite fixed points',
    family: 'structural',
    better: 'lower',
    affineInvariant: false,
    description: 'Inputs with S(x) = complement of x.',
    get: (a) => a.structure.oppositeFixedPoints.length,
  },
];

/**
 * @param {string} id
 * @returns {MetricDef}
 */
export function getMetric(id) {
  const m = METRICS.find((d) => d.id === id);
  if (!m) throw new Error(`Unknown metric ${id}`);
  return m;
}
