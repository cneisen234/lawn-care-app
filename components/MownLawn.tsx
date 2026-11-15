// A freshly striped lawn seen in perspective — the iconic "professional mow"
// look. Vertical stripes fan from a soft far horizon out to full width in the
// foreground, alternating two shades of the same green the way a mower leaves
// light/dark bands. The far edge hazes into the page so the lawn melts into a
// horizon rather than ending on a hard line. Used as a ground band beneath a
// section's content — never overlapping it.

type Props = {
  className?: string;
  style?: React.CSSProperties;
  /* Colour the far-edge haze fades into — match the section it sits under. */
  haze?: string;
};

export default function MownLawn({ className = '', style, haze = '#D9E2D2' }: Props) {
  const W = 1200;
  const H = 300;
  const N = 13;
  const cx = W / 2;
  const spread = 220; // half-width of the lawn at the far horizon (gentle perspective)
  const dark = '#2F5A3A';
  const light = '#437450';

  const stripes = [];
  for (let i = 0; i < N; i++) {
    const xb0 = (W * i) / N;
    const xb1 = (W * (i + 1)) / N;
    const xt0 = cx - spread + (2 * spread * i) / N;
    const xt1 = cx - spread + (2 * spread * (i + 1)) / N;
    stripes.push(
      <polygon
        key={i}
        points={`${xb0.toFixed(1)},${H} ${xb1.toFixed(1)},${H} ${xt1.toFixed(1)},0 ${xt0.toFixed(1)},0`}
        fill={i % 2 === 0 ? dark : light}
      />,
    );
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={className}
      style={{ display: 'block', ...style }}
    >
      <defs>
        <linearGradient id="mownHaze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={haze} stopOpacity="1" />
          <stop offset="0.34" stopColor={haze} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="mownShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1C3323" stopOpacity="0.22" />
          <stop offset="0.5" stopColor="#1C3323" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g>{stripes}</g>
      {/* distance shading, then the haze that melts the far edge into a horizon */}
      <rect x="0" y="0" width={W} height={H} fill="url(#mownShade)" />
      <rect x="0" y="0" width={W} height={H} fill="url(#mownHaze)" />
    </svg>
  );
}
