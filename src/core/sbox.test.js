import { describe, expect, it } from 'vitest';
import { createSBox, formatSBox, inverse, isBalanced, isBijective, parseSBox } from './sbox.js';
import { bitLength, dot, log2Exact, popcount } from './bits.js';

describe('bits', () => {
  it('computes popcount, dot product parity and lengths', () => {
    expect(popcount(0)).toBe(0);
    expect(popcount(0xff)).toBe(8);
    expect(dot(0b1011, 0b0011)).toBe(0);
    expect(dot(0b1011, 0b0010)).toBe(1);
    expect(bitLength(0)).toBe(0);
    expect(bitLength(255)).toBe(8);
    expect(log2Exact(256)).toBe(8);
    expect(log2Exact(12)).toBe(-1);
  });
});

describe('createSBox', () => {
  it('infers widths', () => {
    expect(createSBox([0, 1, 3, 2])).toMatchObject({ n: 2, m: 2 });
    // 6→4 like the DES S-boxes
    const des = createSBox(Array.from({ length: 64 }, (_, i) => i % 16));
    expect(des).toMatchObject({ n: 6, m: 4 });
  });

  it('rejects invalid input', () => {
    expect(() => createSBox([0, 1, 2])).toThrow(/power of two/);
    expect(() => createSBox([0, 4], 2)).toThrow(/does not fit/);
    expect(() => createSBox([0, -1])).toThrow(/non-negative/);
  });
});

describe('properties', () => {
  it('detects bijectivity and balance', () => {
    const perm = createSBox([3, 0, 1, 2]);
    expect(isBijective(perm)).toBe(true);
    expect(isBalanced(perm)).toBe(true);
    expect(isBijective(createSBox([0, 0, 1, 2]))).toBe(false);
    expect(inverse(perm).table).toEqual(Uint8Array.from([1, 2, 3, 0]));
  });
});

describe('parseSBox', () => {
  it('parses decimal lists', () => {
    expect(Array.from(parseSBox('3, 0, 1, 2').table)).toEqual([3, 0, 1, 2]);
  });

  it('parses hex with prefixes and C arrays', () => {
    const s = parseSBox('static const uint8_t S[4] = { 0x03, 0x00, 0x01, 0x02 }; // comment');
    expect(Array.from(s.table)).toEqual([3, 0, 1, 2]);
  });

  it('auto-detects hex from letters', () => {
    const s = parseSBox('C 5 6 B 9 0 A D 3 E F 8 4 7 1 2');
    expect(s.table[0]).toBe(12);
  });

  it('parses compact hex strings', () => {
    expect(Array.from(parseSBox('C56B90AD3EF84712').table.slice(0, 4))).toEqual([12, 5, 6, 11]);
  });

  it('round-trips through formatSBox', () => {
    const s = parseSBox('C56B90AD3EF84712');
    expect(parseSBox(formatSBox(s)).table).toEqual(s.table);
  });

  it('reports bad tokens', () => {
    expect(() => parseSBox('1, 2, zz, 3')).toThrow(/Invalid/);
  });
});
