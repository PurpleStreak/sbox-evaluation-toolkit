/**
 * Header: toolkit name and the S-box currently being analysed.
 * @param {object} props
 * @param {string} props.name
 * @param {{ n: number, m: number, bijective: boolean }} props.properties
 */
export default function TopBar({ name, properties }) {
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
    </header>
  );
}
