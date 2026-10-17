import { describe, expect, it } from 'vitest';
import { dot } from './bits.js';
import { dlct } from './connectivity.js';
import { ddt } from './differential.js';
import { getPreset } from './presets.js';
import { cycleStructure, fixedPoints, isInvolution, linearStructures, oppositeFixedPoints } from './structure.js';

/** @param {string} id */
const preset = (id) => {
  const p = getPreset(id);
  if (!p) throw new Error(`missing preset ${id}`);
  return p.sbox;
};

describe('fixed points and cycles', () => {
  it('reproduces AES design properties', () => {
    const aes = preset('aes');
    expect(fixedPoints(aes)).toEqual([]);
    expect(oppositeFixedPoints(aes)).toEqual([]);
    expect(isInvolution(aes)).toBe(false);
    expect(cycleStructure(aes)).toEqual([87, 81, 59, 27, 2]);
  });

  it('finds the Midori Sb0 fixed points and involution', () => {
    const midori = preset('midori0');
    expect(fixedPoints(midori)).toEqual([3, 7, 8, 9]);
    expect(isInvolution(midori)).toBe(true);
    expect(cycleStructure(midori)).toEqual([2, 2, 2, 2, 2, 2, 1, 1, 1, 1]);
  });

  it('handles non-bijective S-boxes', () => {
    expect(cycleStructure(preset('des1'))).toBeNull();
    expect(fixedPoints(preset('des1'))).toEqual([]);
  });
});

describe('linear structures', () => {
  it('finds none for AES', () => {
    expect(linearStructures(dlct(ddt(preset('aes'))))).toEqual([]);
  });

  it('finds valid ones for PRESENT', () => {
    const s = preset('present');
    const found = linearStructures(dlct(ddt(s)));
    expect(found.length).toBeGreaterThan(0);
    for (const { a, b, constant } of found)
      for (let x = 0; x < 16; x++) expect(dot(b, s.table[x] ^ s.table[x ^ a])).toBe(constant);
  });
});
