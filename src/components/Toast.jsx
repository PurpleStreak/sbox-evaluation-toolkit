import { useEffect } from 'react';

/**
 * Transient status message (announced to screen readers).
 * @param {object} props
 * @param {{ id: number, text: string } | null} props.toast
 * @param {() => void} props.onDone
 */
export default function Toast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDone, 5000);
    return () => clearTimeout(t);
  }, [toast, onDone]);
  return (
    <div className="toast-host" aria-live="polite">
      {toast && (
        <div className="toast" key={toast.id} role="status" onClick={onDone}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
