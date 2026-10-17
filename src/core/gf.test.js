import { describe, expect, it } from 'vitest';
import { DEFAULT_POLY, getField, isIrreducible } from './gf.js';
import { getPreset } from './presets.js';

describe('GF(2^n)', () => {
  it('uses irreducible default polynomials', () => {
    for (const [n, poly] of Object.entries(DEFAULT_POLY)) expect(isIrreducible(poly, Number(n))).toBe(true);
    expect(isIrreducible(0b10101, 4)).toBe(false); // x^4 + x^2 + 1 = (x^2 + x + 1)^2
  });

  it('matches known AES field products', () => {
    const f = getField(8);
    expect(f.mul(0x57, 0x83)).toBe(0xc1); // FIPS-197 example
    expect(f.mul(0x57, 0x13)).toBe(0xfe);
    expect(f.inv(0x53)).toBe(0xca);
    expect(f.inv(0)).toBe(0);
  });

  it('has inverses consistent with pow(a, 2^n - 2)', () => {
    for (const n of [3, 4, 8]) {
      const f = getField(n);
      for (let a = 1; a < f.size; a++) {
        expect(f.mul(a, f.inv(a))).toBe(1);
        expect(f.pow(a, f.size - 2)).toBe(f.inv(a));
      }
    }
  });

  it('rebuilds the AES S-box from inversion + affine map', () => {
    const f = getField(8);
    const rotl = (/** @type {number} */ b, /** @type {number} */ r) => ((b << r) | (b >> (8 - r))) & 0xff;
    const aes = getPreset('aes')?.sbox.table;
    for (let x = 0; x < 256; x++) {
      const b = f.inv(x);
      const s = b ^ rotl(b, 1) ^ rotl(b, 2) ^ rotl(b, 3) ^ rotl(b, 4) ^ 0x63;
      expect(s).toBe(aes?.[x]);
    }
  });
});
