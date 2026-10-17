import { describe, expect, it } from 'vitest';
import { analyze } from './analyze.js';
import { getPreset } from './presets.js';
import { createSearch } from './search.js';
import { isBijective } from './sbox.js';

describe('simulated-annealing search', () => {
  it('keeps incremental tables consistent with a full analysis', () => {
    for (const n of [4, 5, 6]) {
      const search = createSearch({ n, seed: n, iterations: 2000 });
      for (let k = 0; k < 4; k++) {
        const stats = search.step(500);
        const full = analyze(search.currentSBox());
        expect(stats.current.nonlinearity).toBe(full.linear.nonlinearity);
        expect(stats.current.uniformity).toBe(full.differential.uniformity);
        expect(isBijective(search.currentSBox())).toBe(true);
      }
      const best = analyze(search.bestSBox());
      expect(search.stats().best.nonlinearity).toBe(best.linear.nonlinearity);
      expect(search.stats().best.uniformity).toBe(best.differential.uniformity);
    }
  });

  it('is reproducible from its seed', () => {
    const run = () => {
      const s = createSearch({ n: 5, seed: 99, iterations: 1000 });
      s.step(1000);
      return s.bestSBox().table;
    };
    expect(run()).toEqual(run());
  });

  it('finds an optimal 4-bit S-box', () => {
    const s = createSearch({ n: 4, seed: 3, iterations: 3000 });
    s.step(3000);
    expect(s.stats().best).toMatchObject({ nonlinearity: 4, uniformity: 4 });
    expect(s.done).toBe(true);
  });

  it('improves a random 8-bit permutation', () => {
    const s = createSearch({ n: 8, seed: 1, iterations: 3000 });
    const start = s.stats().current;
    s.step(3000);
    const { best } = s.stats();
    expect(best.cost).toBeLessThan(start.cost);
    expect(best.nonlinearity).toBeGreaterThanOrEqual(start.nonlinearity);
  });

  it('can start from a given permutation', () => {
    const aes = getPreset('aes')?.sbox;
    const s = createSearch({ n: 8, seed: 1, iterations: 0, start: aes });
    expect(s.stats().best).toMatchObject({ nonlinearity: 112, uniformity: 4 });
    expect(() => createSearch({ n: 6, seed: 1, start: getPreset('des1')?.sbox })).toThrow();
  });
});
