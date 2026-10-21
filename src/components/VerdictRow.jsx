import { verdict } from '../core/verdict.js';

/** Status label, icon and colour for each verdict level (icon + label, never colour alone). */
const LEVELS = {
  strong: { label: 'Strong', icon: '✓', color: 'var(--good)' },
  caution: { label: 'Caution', icon: '!', color: 'var(--warn)' },
  weak: { label: 'Weak', icon: '✕', color: 'var(--crit)' },
  na: { label: 'No baseline', icon: '–', color: 'var(--muted)' },
};

/**
 * One card per attack family with a level, the key value and the reason.
 * @param {object} props
 * @param {import('../core/analyze.js').Analysis} props.analysis
 */
export default function VerdictRow({ analysis }) {
  const cards = verdict(analysis);
  return (
    <section className="verdict-wrap" aria-label="Attack verdict">
      <div className="section-title">
        <h2>Attack verdict</h2>
        <p className="explain-only muted">
          How this S-box holds up against each family of attacks, judged against the best known values and 10,000 random
          permutations of the same size. The S-box is judged in isolation; a full cipher also depends on its other layers.
        </p>
      </div>
      <div className="verdict">
        {cards.map((c) => {
          const lv = LEVELS[c.level];
          return (
            <div className={`card level-${c.level}`} key={c.family}>
              <div className="fam">{c.title}</div>
              <div className="status">
                <span className="ico" style={{ background: lv.color }} aria-hidden="true">
                  {lv.icon}
                </span>
                {lv.label}
              </div>
              <div className="val">{c.value}</div>
              <div className="why">{c.reason}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
