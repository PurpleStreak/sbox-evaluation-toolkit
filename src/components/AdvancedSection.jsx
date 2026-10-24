import SearchPanel from './SearchPanel.jsx';

/**
 * Collapsible section for heavier, optional tools. Collapsed by default to keep the main
 * view focused; the content stays mounted while closed, so a running search continues.
 * @param {object} props
 * @param {(sbox: import('../core/sbox.js').SBox, name: string, opts?: { related?: boolean }) => unknown} props.onLoad
 */
export default function AdvancedSection({ onLoad }) {
  return (
    <details className="panel advanced">
      <summary>
        <h2>Advanced</h2>
        <span className="small muted">heuristic S-box search</span>
      </summary>
      <SearchPanel onLoad={onLoad} />
    </details>
  );
}
