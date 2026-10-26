import type { Obs } from '../lib/types';

interface Props {
  series: Obs[];
  from: number;
  to: number;
  highlight?: number;
  width?: number;
  height?: number;
  color?: string;
  zeroLine?: boolean;
  label: string;
}

/** Minimal inline trend line. Gaps in the data stay gaps. */
export default function Sparkline({ series, from, to, highlight, width = 120, height = 32, color = '#2f6db5', zeroLine, label }: Props) {
  const pts = series.filter((o) => o[0] >= from && o[0] <= to);
  if (pts.length < 2) return <svg width={width} height={height} role="img" aria-label={`${label}: not enough data for a trend`} />;
  const vals = pts.map((o) => o[1]);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (zeroLine) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (hi === lo) { hi += 1; lo -= 1; }
  const pad = 3;
  const x = (y: number) => pad + ((y - from) / Math.max(1, to - from)) * (width - pad * 2);
  const yv = (v: number) => pad + (1 - (v - lo) / (hi - lo)) * (height - pad * 2);
  const segs: string[] = [];
  let cur = '';
  pts.forEach((o, i) => {
    const gap = i > 0 && o[0] - pts[i - 1][0] > 1;
    cur += `${cur && !gap ? 'L' : (cur ? ' M' : 'M')}${x(o[0]).toFixed(1)},${yv(o[1]).toFixed(1)}`;
  });
  segs.push(cur);
  const h = highlight !== undefined ? pts.find((o) => o[0] === highlight) : undefined;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}, ${pts[0][0]} to ${pts[pts.length - 1][0]}`} className="sparkline">
      {zeroLine && lo < 0 && <line x1={pad} x2={width - pad} y1={yv(0)} y2={yv(0)} stroke="#d6cfc2" strokeWidth={1} />}
      {segs.map((d, i) => <path key={i} d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />)}
      {h && <circle cx={x(h[0])} cy={yv(h[1])} r={3} fill={color} stroke="#fffdf8" strokeWidth={1.5} />}
    </svg>
  );
}
