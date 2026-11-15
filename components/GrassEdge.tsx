// Signature motif: a hand-varied row of grass blades that sits where two
// sections meet. Blades have deterministic (SSR-stable) variation in height,
// width and lean, plus a back layer for depth — so it reads as real grass, not
// a repeated sawtooth. Fluid width via preserveAspectRatio="none".

function pseudo(i: number, seed: number) {
  const x = Math.sin(i * 127.1 + seed) * 43758.5453;
  return x - Math.floor(x);
}

function blades(width: number, h: number, seed: number, minH: number, gap: number) {
  const paths: string[] = [];
  let x = -8;
  let i = 0;
  while (x < width + 12) {
    const p = pseudo(i, seed);
    const height = h * (minH + (1 - minH) * p);
    const w = 9 + 7 * pseudo(i, seed + 3.3);
    const lean = (pseudo(i, seed + 7.7) - 0.5) * (w * 1.7);
    const tipX = x + w / 2 + lean;
    const tipY = h - height;
    paths.push(
      `M${x.toFixed(1)} ${h} Q ${(x + w * 0.28).toFixed(1)} ${(h - height * 0.55).toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)} Q ${(x + w * 0.72).toFixed(1)} ${(h - height * 0.55).toFixed(1)} ${(x + w).toFixed(1)} ${h} Z`,
    );
    x += w * 0.55 + gap * (0.5 + pseudo(i, seed + 1.1));
    i++;
  }
  return paths;
}

type Props = {
  height?: number;
  fill?: string;
  fillBack?: string;
  flip?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

export default function GrassEdge({
  height = 54,
  fill = 'var(--forest)',
  fillBack = 'var(--forest-deep)',
  flip = false,
  className = '',
  style,
}: Props) {
  const W = 1440;
  const back = blades(W, height, 2.0, 0.62, 20);
  const front = blades(W, height, 9.4, 0.4, 13);
  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={className}
      style={{ display: 'block', transform: flip ? 'scaleY(-1)' : undefined, ...style }}
    >
      <g fill={fillBack}>
        {back.map((d, k) => (
          <path key={`b${k}`} d={d} />
        ))}
      </g>
      <g fill={fill}>
        {front.map((d, k) => (
          <path key={`f${k}`} d={d} />
        ))}
      </g>
    </svg>
  );
}
