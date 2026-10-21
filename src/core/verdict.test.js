import { describe, expect, it } from 'vitest';
import { analyze } from './analyze.js';
import { getPreset } from './presets.js';
import { createSBox } from './sbox.js';
import { verdict } from './verdict.js';

/** @param {string} id */
const levels = (id) => {
  const p = getPreset(id);
  if (!p) throw new Error(`missing preset ${id}`);
  return Object.fromEntries(verdict(analyze(p.sbox)).map((v) => [v.family, v.level]));
};

describe('verdict', () => {
  it('rates AES strong except for its algebraic structure', () => {
    expect(levels('aes')).toEqual({
      differential: 'strong',
      linear: 'strong',
      boomerang: 'strong',
      'differential-linear': 'strong',
      algebraic: 'caution',
      structural: 'strong',
      avalanche: 'strong',
    });
  });

  it('judges 4-bit S-boxes relative to what is typical for 4 bits', () => {
    const present = levels('present');
    expect(present.differential).toBe('strong');
    expect(present.linear).toBe('strong');
    expect(present.algebraic).toBe('caution'); // quadratic components are the norm at 4 bits
    expect(levels('gift').differential).not.toBe('strong'); // δ = 6
  });

  it('flags Midori fixed points', () => {
    expect(levels('midori0').structural).not.toBe('strong');
  });

  it('rates the identity map weak', () => {
    const v = Object.fromEntries(verdict(analyze(createSBox(Array.from({ length: 256 }, (_, i) => i)))).map((x) => [x.family, x.level]));
    expect(v.differential).toBe('weak');
    expect(v.linear).toBe('weak');
    expect(v.structural).toBe('weak');
    expect(v.avalanche).toBe('weak'); // SAC mean 0.125: far outside the random range
  });

  it('reports missing baselines for n ≠ m', () => {
    const v = verdict(analyze(getPreset('des1')?.sbox ?? createSBox([0, 1])));
    expect(v.find((x) => x.family === 'differential')?.level).toBe('na');
    expect(v.find((x) => x.family === 'boomerang')?.level).toBe('na');
  });
});
