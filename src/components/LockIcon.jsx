/** Small padlock marking affine-invariant metrics. */
export default function LockIcon() {
  return (
    <svg className="lock" viewBox="0 0 12 12" width="11" height="11" role="img" aria-label="Affine invariant">
      <title>Affine invariant: cannot change under affine re-encoding</title>
      <rect x="2" y="5.5" width="8" height="5.5" rx="1.2" fill="currentColor" />
      <path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
