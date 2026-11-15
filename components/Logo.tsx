// The App's brand mark, borrowed from Andy's Lawn Care (plan.md Section 3F): a
// forest badge with grass blades + a warm sun, beside the slab wordmark. Swap
// this component out if the App gets its own logo with its name (gate M6).

export default function Logo({
  size = 44,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Badge */}
        <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="var(--forest)" stroke="var(--forest-deep)" strokeWidth="2" />
        {/* Sun */}
        <circle cx="34" cy="15" r="5" fill="var(--tan)" />
        {/* Ground line */}
        <path d="M8 36 H40" stroke="var(--tan-soft)" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
        {/* Grass blades */}
        <path d="M14 37 C13 30 12 27 10 24" stroke="var(--moss)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <path d="M19 37 C18.5 28 19 25 17.5 21" stroke="var(--bone)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <path d="M24 37 C24 27 25 23 24 19" stroke="var(--moss)" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <path d="M29 37 C29.5 28 30 25 32 22" stroke="var(--bone)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <path d="M34 37 C35 31 36 28 38 26" stroke="var(--moss)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      </svg>
    </span>
  );
}
