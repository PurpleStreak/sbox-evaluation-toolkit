/**
 * @param {object} props
 * @param {string} props.name
 * @param {{ n: number, m: number, bijective: boolean }} props.properties
 * @param {'explain' | 'expert'} props.mode
 * @param {(mode: 'explain' | 'expert') => void} props.onMode
 * @param {'dark' | 'light'} props.theme
 * @param {() => void} props.onToggleTheme
 */
export default function TopBar({ name, properties, mode, onMode, theme, onToggleTheme }) {
  return (
    <header className="topbar">
      <div className="brand">
        S-Box <span className="accent">Evaluation Toolkit</span>
      </div>
      <div className="current">
        <span className="muted">Analysing</span> <strong>{name}</strong>
        <span className="chip">
          {properties.n}→{properties.m} bits{properties.bijective ? ' · bijective' : ''}
        </span>
      </div>
      <div className="toggles">
        <div className="seg" role="group" aria-label="Detail level">
          {/** @type {const} */ (['explain', 'expert']).map((m) => (
            <button key={m} className={mode === m ? 'on' : ''} aria-pressed={mode === m} onClick={() => onMode(m)}>
              {m === 'explain' ? 'Explain' : 'Expert'}
            </button>
          ))}
        </div>
        <button className="ghost" onClick={onToggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
          ◐ Theme
        </button>
      </div>
    </header>
  );
}
