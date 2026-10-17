import { describe, expect, it } from 'vitest';
import { dot } from './bits.js';
import { componentNonlinearities, lat, linearBranchNumber, linearity, nonlinearity, walsh, walshSpectrum } from './linear.js';
import { get } from './matrix.js';
import { getPreset } from './presets.js';
import { createSBox } from './sbox.js';

/** @param {string} id */
const preset = (id) => {
  const p = getPreset(id);
  if (!p) throw new Error(`missing preset ${id}`);
  return p.sbox;
};

describe('Walsh / LAT', () => {
  it('matches the naive LAT definition (incl. n ≠ m)', () => {
    for (const s of [preset('present'), preset('des1'), createSBox([1, 3, 0, 2, 7, 6, 4, 5])]) {
      const table = lat(s);
      for (let a = 0; a < 1 << s.n; a++) {
        for (let b = 0; b < 1 << s.m; b++) {
          let count = 0;
          for (let x = 0; x < 1 << s.n; x++) if (dot(a, x) === dot(b, s.table[x])) count++;
          expect(get(table, a, b)).toBe(count - (1 << (s.n - 1)));
        }
      }
    }
  });

  it('reproduces known AES values', () => {
    const w = walsh(preset('aes'));
    expect(nonlinearity(w)).toBe(112);
    expect(linearity(w)).toBe(32);
    expect(componentNonlinearities(w).slice(1).every((nl) => nl === 112)).toBe(true);
    expect(linearBranchNumber(w)).toBe(2);
    // Parseval: Σ_a W[a][b]^2 = 2^(2n) for each b.
    let sum = 0;
    for (let a = 0; a < 256; a++) sum += get(w, a, 5) ** 2;
    expect(sum).toBe(65536);
    expect([...walshSpectrum(w).keys()].every((v) => v % 4 === 0 && v <= 32)).toBe(true);
  });

  it('reproduces known 4-bit values', () => {
    for (const id of ['present', 'gift', 'skinny4', 'serpent0', 'prince', 'midori0'])
      expect(nonlinearity(walsh(preset(id)))).toBe(4);
    expect(linearBranchNumber(walsh(preset('present')))).toBe(2);
  });

  it('gives nonlinearity 0 for an affine S-box', () => {
    const affine = createSBox(Array.from({ length: 16 }, (_, x) => x ^ 0b1010));
    expect(nonlinearity(walsh(affine))).toBe(0);
  });
});
