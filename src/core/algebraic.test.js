import { describe, expect, it } from 'vitest';
import { algebraicDegrees, anfToString, componentAnfs, interpolationPolynomial, mobius, quadraticEquations } from './algebraic.js';
import { getField } from './gf.js';
import { getPreset } from './presets.js';
import { createSBox } from './sbox.js';

/** @param {string} id */
const preset = (id) => {
  const p = getPreset(id);
  if (!p) throw new Error(`missing preset ${id}`);
  return p.sbox;
};

describe('ANF', () => {
  it('is an involution and evaluates back to the truth table', () => {
    const truth = Uint8Array.from([0, 1, 1, 0, 1, 0, 0, 1]); // x0 ⊕ x1 ⊕ x2
    const anf = mobius(truth);
    expect(anfToString(anf)).toBe('x0 ⊕ x1 ⊕ x2');
    expect(mobius(anf)).toEqual(truth);
    expect(anfToString(mobius(Uint8Array.from([1, 1, 1, 0])))).toBe('x0x1 ⊕ 1'); // NAND
  });

  it('computes component ANFs consistently with the truth table', () => {
    const s = preset('present');
    componentAnfs(s).forEach((anf, b) => {
      const truth = mobius(anf);
      for (let x = 0; x < 16; x++) {
        let bit = 0;
        for (let v = s.table[x] & b; v; v >>= 1) bit ^= v & 1;
        expect(truth[x]).toBe(bit);
      }
    });
  });
});

describe('algebraic degree', () => {
  it('reproduces known values', () => {
    expect(algebraicDegrees(preset('aes'))).toMatchObject({ degree: 7, minComponentDegree: 7 });
    expect(algebraicDegrees(preset('present'))).toMatchObject({ degree: 3, minComponentDegree: 2 });
    expect(algebraicDegrees(createSBox([0, 1, 2, 3, 4, 5, 6, 7]))).toMatchObject({ degree: 1 });
  });
});

describe('quadratic equations', () => {
  it('reproduces the 39 AES and 21 PRESENT equations', () => {
    expect(quadraticEquations(preset('aes'))).toEqual({ equations: 39, monomials: 137 });
    expect(quadraticEquations(preset('present'))).toEqual({ equations: 21, monomials: 37 });
  });
});

describe('interpolation polynomial', () => {
  it('reproduces the 9-term AES polynomial', () => {
    const { coefficients, terms, degree } = interpolationPolynomial(preset('aes'));
    expect(terms).toBe(9);
    expect(degree).toBe(254);
    const expected = { 254: 0x05, 253: 0x09, 251: 0xf9, 247: 0x25, 239: 0xf4, 223: 0x01, 191: 0xb5, 127: 0x8f, 0: 0x63 };
    for (const [k, v] of Object.entries(expected)) expect(coefficients[Number(k)]).toBe(v);
  });

  it('evaluates back to the S-box', () => {
    const s = preset('prince');
    const f = getField(4);
    const { coefficients } = interpolationPolynomial(s);
    for (let x = 0; x < 16; x++) {
      let y = 0;
      coefficients.forEach((c, k) => {
        y ^= f.mul(c, f.pow(x, k));
      });
      expect(y).toBe(s.table[x]);
    }
  });
});
