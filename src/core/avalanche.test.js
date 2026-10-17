import { describe, expect, it } from 'vitest';
import { avalancheWeights, bic, sac } from './avalanche.js';
import { componentNonlinearities, walsh } from './linear.js';
import { getPreset } from './presets.js';
import { createSBox } from './sbox.js';

/** @param {string} id */
const preset = (id) => {
  const p = getPreset(id);
  if (!p) throw new Error(`missing preset ${id}`);
  return p.sbox;
};

describe('SAC', () => {
  it('reproduces published AES values', () => {
    const r = sac(preset('aes'));
    expect(r.mean).toBeCloseTo(0.5049, 4);
    expect(r.min).toBe(0.453125);
    expect(r.max).toBe(0.5625);
  });

  it('is 0 or 1 for a bit permutation', () => {
    const s = createSBox(Array.from({ length: 8 }, (_, x) => ((x << 1) | (x >> 2)) & 7)); // rotate left
    const r = sac(s);
    expect([...r.matrix].every((v) => v === 0 || v === 1)).toBe(true);
    expect(r.maxDeviation).toBe(0.5);
  });
});

describe('BIC', () => {
  it('reproduces published AES values', () => {
    const s = preset('aes');
    const r = bic(s, componentNonlinearities(walsh(s)));
    expect(r.nl.min).toBe(112);
    expect(r.sac.mean).toBeCloseTo(0.5046, 4);
  });

  it('handles single-output-bit S-boxes', () => {
    const s = createSBox([0, 1, 1, 0], 1);
    expect(Number.isNaN(bic(s, componentNonlinearities(walsh(s))).nl.min)).toBe(true);
  });
});

describe('avalanche weights', () => {
  it('averages close to m/2 for AES', () => {
    const w = avalancheWeights(preset('aes'));
    expect(w).toHaveLength(8);
    for (const v of w) expect(Math.abs(v - 4)).toBeLessThan(0.25);
  });
});
