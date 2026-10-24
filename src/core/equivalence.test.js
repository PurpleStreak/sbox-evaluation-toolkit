import { describe, expect, it } from 'vitest';
import { analyze } from './analyze.js';
import { OPTIMAL_4BIT_CLASSES, affineEquivalence, invariantFingerprint, linearEquivalence, optimalClass4 } from './equivalence.js';
import { affineTransform, applyAffine, powerMap, randomAffineMap, randomPermutation } from './generators.js';
import { getPreset } from './presets.js';
import { createSearch } from './search.js';
import { createSBox } from './sbox.js';

/** @param {string} id */
const preset = (id) => {
  const p = getPreset(id);
  if (!p) throw new Error(`missing preset ${id}`);
  return p.sbox;
};

/**
 * Check that the returned maps really satisfy s2 = B ∘ s1 ∘ A.
 * @param {import('./sbox.js').SBox} s1
 * @param {import('./sbox.js').SBox} s2
 * @param {import('./equivalence.js').EquivalenceResult} r
 */
function expectMaps(s1, s2, r) {
  expect(r.status).toBe('equivalent');
  if (r.status !== 'equivalent') return;
  for (let x = 0; x < s1.table.length; x++) expect(applyAffine(r.B, s1.table[applyAffine(r.A, x)])).toBe(s2.table[x]);
}

describe('linear equivalence', () => {
  it('recovers linear maps between linearly equivalent permutations', () => {
    const s = preset('present').table;
    // A linear bijection given by the images of the basis vectors.
    const basis = [3, 5, 9, 1];
    const lin = Array.from({ length: 16 }, (_, x) => basis.reduce((acc, b, i) => ((x >> i) & 1 ? acc ^ b : acc), 0));
    const s0 = Array.from(s, (y) => y ^ s[0]); // force S(0) = 0
    const s2 = Array.from({ length: 16 }, (_, x) => lin[s0[lin[x]]]);
    const sol = linearEquivalence(s0, s2);
    expect(sol).not.toBeNull();
    if (sol) for (let x = 0; x < 16; x++) expect(sol.B[s0[sol.A[x]]]).toBe(s2[x]);
  });
});

describe('affine equivalence', () => {
  it('finds AES to be affine equivalent to inversion, its inverse and disguised copies', () => {
    const aes = preset('aes');
    const inv = powerMap({ n: 8, exponent: 254 }).sbox;
    expectMaps(inv, aes, affineEquivalence(inv, aes));
    expectMaps(aes, preset('aes-inv'), affineEquivalence(aes, preset('aes-inv')));
    // Searching constants on both sides keeps the hard direction fast too.
    const back = affineEquivalence(preset('aes-inv'), aes);
    expectMaps(preset('aes-inv'), aes, back);
    expect(back.status === 'equivalent' && back.constantsTried).toBeLessThanOrEqual(4);
    const disguised = affineTransform(aes, randomAffineMap(8, 1), randomAffineMap(8, 2));
    expectMaps(aes, disguised, affineEquivalence(aes, disguised));
  });

  it('rejects non-equivalent S-boxes, citing the differing invariant', () => {
    const r = affineEquivalence(preset('aes'), randomPermutation(8, 3));
    expect(r.status).toBe('not-equivalent');
    expect(r.status === 'not-equivalent' && r.invariant).toBeTruthy();
    expect(affineEquivalence(preset('present'), preset('gift')).status).toBe('not-equivalent');
  });

  it('refuses incompatible inputs', () => {
    expect(affineEquivalence(preset('aes'), preset('present')).status).toBe('incompatible');
    expect(affineEquivalence(preset('des1'), preset('des1')).status).toBe('incompatible');
  });

  it('can be cancelled', () => {
    const g0 = OPTIMAL_4BIT_CLASSES[0];
    const g1 = OPTIMAL_4BIT_CLASSES[1];
    const r = affineEquivalence(g0, g1, { shouldStop: () => true, fingerprints: [[], []] });
    expect(r.status).toBe('cancelled');
  });

  it('splits all 40,320 3-bit permutations into exactly 4 affine classes', () => {
    /** @type {{ rep: import('./sbox.js').SBox, fp: [string, string][], size: number }[]} */
    const classes = [];
    const perm = [0, 1, 2, 3, 4, 5, 6, 7];
    // Heap's algorithm over all permutations of 8 elements.
    const c = new Array(8).fill(0);
    const visit = () => {
      const s = createSBox(perm, 3);
      const fp = invariantFingerprint(s);
      for (const cl of classes) {
        if (affineEquivalence(cl.rep, s, { fingerprints: [cl.fp, fp] }).status === 'equivalent') {
          cl.size++;
          return;
        }
      }
      classes.push({ rep: s, fp, size: 1 });
    };
    visit();
    let i = 0;
    while (i < 8) {
      if (c[i] < i) {
        const j = i % 2 === 0 ? 0 : c[i];
        [perm[j], perm[i]] = [perm[i], perm[j]];
        visit();
        c[i]++;
        i = 0;
      } else {
        c[i] = 0;
        i++;
      }
    }
    expect(classes).toHaveLength(4);
    expect(classes.reduce((a, cl) => a + cl.size, 0)).toBe(40320);
  }, 60000);
});

describe('4-bit optimal classes (Leander–Poschmann)', () => {
  it('has 16 optimal, pairwise non-equivalent representatives', () => {
    expect(OPTIMAL_4BIT_CLASSES).toHaveLength(16);
    for (const g of OPTIMAL_4BIT_CLASSES) {
      const a = analyze(g);
      expect(a.differential.uniformity).toBe(4);
      expect(a.linear.nonlinearity).toBe(4);
    }
    for (let i = 0; i < 16; i++)
      for (let j = i + 1; j < 16; j++) expect(affineEquivalence(OPTIMAL_4BIT_CLASSES[i], OPTIMAL_4BIT_CLASSES[j]).status, `G${i} vs G${j}`).toBe('not-equivalent');
  });

  it('classifies affine copies of each representative back to it', () => {
    OPTIMAL_4BIT_CLASSES.forEach((g, i) => {
      const s = affineTransform(g, randomAffineMap(4, 100 + i), randomAffineMap(4, 200 + i));
      const r = optimalClass4(s);
      expect(r.status === 'optimal' && r.index).toBe(i);
      if (r.status === 'optimal') for (let x = 0; x < 16; x++) expect(applyAffine(r.B, g.table[applyAffine(r.A, x)])).toBe(s.table[x]);
    });
  });

  it('places every optimal S-box found by search in one of the 16 classes', () => {
    let optimal = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const search = createSearch({ n: 4, seed, iterations: 1500 });
      search.step(1500);
      const best = search.bestSBox();
      const r = optimalClass4(best);
      if (search.stats().best.uniformity === 4 && search.stats().best.nonlinearity === 4) {
        optimal++;
        expect(r.status, `seed ${seed}`).toBe('optimal');
      } else expect(r.status).toBe('not-optimal');
    }
    expect(optimal).toBeGreaterThan(20);
  }, 60000);

  it('classifies the reference S-boxes', () => {
    /** @param {string} id */
    const label = (id) => {
      const r = optimalClass4(preset(id));
      return r.status === 'optimal' ? r.label : r.status;
    };
    expect(label('present')).toBe('G1'); // as reported by Leander & Poschmann
    expect(label('prince')).toBe('G13');
    expect(label('gift')).toBe('not-optimal'); // δ = 6
    expect(label('aes')).toBe('not-applicable');
  });
});
