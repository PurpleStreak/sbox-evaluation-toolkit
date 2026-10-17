import { describe, expect, it } from 'vitest';
import { analyze } from './analyze.js';
import { baselineSizes, compareToBaseline, getPresetSummary } from './baseline.js';
import { METRICS } from './metrics.js';
import { PRESETS } from './presets.js';

describe('precomputed preset data', () => {
  it('matches a live analysis (run `npm run precompute` if this fails)', () => {
    for (const p of PRESETS) {
      const summary = getPresetSummary(p.id);
      expect(summary, p.id).toBeDefined();
      const a = analyze(p.sbox);
      for (const m of METRICS) {
        const live = m.get(a);
        const stored = summary?.metrics[m.id];
        if (live === null) expect(stored).toBeNull();
        else expect(stored).toBeCloseTo(live, 5);
      }
    }
  });
});

describe('random baseline', () => {
  it('covers 3..8-bit permutations', () => {
    expect(baselineSizes()).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it('ranks AES above every random 8-bit permutation', () => {
    expect(compareToBaseline('nonlinearity', 8, 112)?.betterThan).toBe(1);
    expect(compareToBaseline('differentialUniformity', 8, 4)?.betterThan).toBe(1);
  });

  it('places typical values mid-distribution and respects direction', () => {
    const nl = compareToBaseline('nonlinearity', 8, 94);
    expect(nl?.percentile).toBeGreaterThan(0.4);
    expect(nl?.percentile).toBeLessThan(0.9);
    expect(nl?.median).toBe(92);
    // Lower is better for δ: a terrible δ beats almost nothing.
    expect(compareToBaseline('differentialUniformity', 8, 18)?.betterThan).toBeLessThan(0.01);
    // closer-to-half: 0.5 exactly is at least as good as all samples.
    expect(compareToBaseline('sacMean', 8, 0.5)?.percentile).toBeGreaterThan(0.99);
  });

  it('returns null without a baseline', () => {
    expect(compareToBaseline('nonlinearity', 2, 0)).toBeNull();
    expect(compareToBaseline('nonlinearity', 8, null)).toBeNull();
  });
});
