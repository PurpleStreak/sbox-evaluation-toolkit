import { describe, expect, it } from 'vitest';
import { analyze } from './analyze.js';
import { METRICS, getMetric } from './metrics.js';
import { PRESETS, getPreset } from './presets.js';
import { createSBox } from './sbox.js';

/** @param {string} id */
const preset = (id) => {
  const p = getPreset(id);
  if (!p) throw new Error(`missing preset ${id}`);
  return p.sbox;
};

describe('analyze', () => {
  it('summarises AES', () => {
    const a = analyze(preset('aes'));
    expect(a.properties).toMatchObject({ n: 8, m: 8, bijective: true, balanced: true, involution: false });
    expect(a.differential.maxProbability).toBe(4 / 256);
    expect(a.linear.maxBias).toBe(16 / 256);
    expect(a.boomerang.uniformity).toBe(6);
    expect(a.algebraic.interpolation?.terms).toBe(9);
  });

  it('runs on every preset and every metric resolves', () => {
    for (const p of PRESETS) {
      const a = analyze(p.sbox);
      for (const m of METRICS) {
        const v = m.get(a);
        expect(v === null || Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('marks affine invariants that really are invariant', () => {
    // Apply random affine maps on both sides of AES and compare.
    const aes = preset('aes');
    const A = [0x1f, 0x3e, 0x7c, 0xf8, 0xf1, 0xe3, 0xc7, 0x8f]; // AES affine matrix rows (invertible)
    const lin = (/** @type {number} */ x) => A.reduce((acc, row, i) => acc | ((popParity(row & x)) << i), 0);
    const popParity = (/** @type {number} */ v) => { let p = 0; for (; v; v >>= 1) p ^= v & 1; return p; };
    const table = Array.from({ length: 256 }, (_, x) => lin(aes.table[lin(x) ^ 0x5a]) ^ 0xc3);
    const a1 = analyze(aes);
    const a2 = analyze(createSBox(table));
    for (const m of METRICS.filter((d) => d.affineInvariant)) expect(m.get(a2), m.id).toBe(m.get(a1));
    // …and at least one non-invariant metric actually changes.
    expect(getMetric('fixedPoints').get(a2) !== 0 || getMetric('interpolationTerms').get(a2) !== 9).toBe(true);
  });

  it('is fast enough for interactive use', () => {
    const start = performance.now();
    analyze(preset('aes'));
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
