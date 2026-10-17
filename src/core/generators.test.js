import { describe, expect, it } from 'vitest';
import { analyze } from './analyze.js';
import { AES_AFFINE, affineTransform, matrixRank, notableExponents, powerMap, randomAffineMap, randomFunction, randomPermutation } from './generators.js';
import { METRICS } from './metrics.js';
import { getPreset } from './presets.js';
import { isBijective } from './sbox.js';

describe('random generators', () => {
  it('produce reproducible permutations', () => {
    const a = randomPermutation(8, 42);
    expect(isBijective(a)).toBe(true);
    expect(randomPermutation(8, 42).table).toEqual(a.table);
    expect(randomPermutation(8, 43).table).not.toEqual(a.table);
  });

  it('produce n→m functions', () => {
    const f = randomFunction(6, 4, 1);
    expect(f).toMatchObject({ n: 6, m: 4 });
    expect(Math.max(...f.table)).toBeLessThan(16);
  });

  it('produce invertible affine maps', () => {
    for (let seed = 0; seed < 20; seed++) expect(matrixRank(randomAffineMap(8, seed).matrix)).toBe(8);
    expect(matrixRank(AES_AFFINE.matrix)).toBe(8);
  });
});

describe('power maps', () => {
  it('rebuild AES from inversion + the AES affine map', () => {
    const { sbox, bijective } = powerMap({ n: 8, exponent: 254, outputMap: AES_AFFINE });
    expect(bijective).toBe(true);
    expect(sbox.table).toEqual(getPreset('aes')?.sbox.table);
  });

  it('detect non-bijective exponents', () => {
    expect(powerMap({ n: 8, exponent: 3 }).bijective).toBe(false); // gcd(3, 255) = 3
    expect(powerMap({ n: 7, exponent: 3 }).bijective).toBe(true);
  });

  it('give APN Gold maps for odd n', () => {
    const { sbox } = powerMap({ n: 5, exponent: 3 });
    expect(analyze(sbox).differential.uniformity).toBe(2);
  });

  it('list notable exponents', () => {
    const list = notableExponents(8);
    expect(list[0]).toMatchObject({ exponent: 254, name: 'Inverse' });
    expect(new Set(list.map((e) => e.exponent)).size).toBe(list.length);
  });
});

describe('affineTransform', () => {
  it('preserves affine-invariant metrics', () => {
    const base = getPreset('present')?.sbox;
    if (!base) throw new Error('missing preset');
    const t = affineTransform(base, randomAffineMap(4, 7), randomAffineMap(4, 8));
    const [a, b] = [analyze(base), analyze(t)];
    for (const m of METRICS.filter((d) => d.affineInvariant)) expect(m.get(b), m.id).toBe(m.get(a));
  });
});
