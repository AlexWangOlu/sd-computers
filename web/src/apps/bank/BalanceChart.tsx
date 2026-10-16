import { useId, useMemo, useRef, useState, type MouseEvent } from 'react';
import { t } from '@/i18n';
import { fmtMoney, fmtMonthDay, fmtTime } from '@/lib/format';
import { useWidth } from './hooks';
import type { Tx } from './types';
import { fmtCompactMoney, fmtSigned, txDelta } from './util';

/** One point of the balance line: the bank balance right AFTER `label` happened at `t`. */
export interface BalancePoint {
  t: number;
  v: number;
  label: string;
  delta?: number;
}

/**
 * The bank balance over the statement window, rebuilt BACKWARDS from today's balance: the server
 * only knows the current balance plus the recent statement (newest first), so walking the
 * statement from newest to oldest and undoing each line (`before = after - delta`) yields the
 * balance after every line, and finally the opening balance before the oldest one. A trailing
 * "now" point carries the line up to the present. Returns [] for no statement.
 *
 * It is exactly as complete as the statement: a movement the source never recorded is not in the
 * line either, which is why the page says the chart is worked out from the listed transactions.
 */
export function buildSeries(txs: Tx[], balance: number, nowSec = Math.floor(Date.now() / 1000)): BalancePoint[] {
  if (txs.length === 0) return [];
  // The server already sends newest first; a stable sort keeps same-second lines in that order.
  const newest = [...txs].sort((a, b) => b.time - a.time);
  const out: BalancePoint[] = [];
  if (nowSec > newest[0].time) out.push({ t: nowSec, v: balance, label: t('ui.bank.chart_now') });
  let bal = balance;
  for (const tx of newest) {
    const d = txDelta(tx);
    out.push({ t: tx.time, v: bal, label: tx.title, delta: d });
    bal -= d;
  }
  const oldest = newest[newest.length - 1].time;
  const span = Math.max(3600, (out[0].t - oldest) * 0.03);
  out.push({ t: oldest - span, v: bal, label: t('ui.bank.chart_opening') });
  return out.reverse();
}

/** "Nice" round gridline values covering [min, max] in about `count` steps. */
function niceTicks(min: number, max: number, count: number): { lo: number; hi: number; ticks: number[] } {
  if (max - min < 1) {
    const pad = Math.max(Math.abs(max) * 0.1, 100);
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let i = 0; lo + i * step <= hi + step / 1000; i++) ticks.push(lo + i * step);
  return { lo, hi, ticks };
}

/**
 * Monotone cubic path through the points (the "monotone X" curve): smooth, but never overshoots,
 * so the line can't suggest a balance the account never had.
 */
function monotonePath(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n === 0) return '';
  if (n < 3) return xs.map((x, i) => `${i ? 'L' : 'M'}${x},${ys[i]}`).join('');
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = xs[i + 1] - xs[i];
    m[i] = dx[i] === 0 ? 0 : (ys[i + 1] - ys[i]) / dx[i];
  }
  const tan: number[] = new Array(n);
  tan[0] = m[0];
  tan[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) tan[i] = 0;
    else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      tan[i] = (w1 + w2) / (w1 / m[i - 1] + w2 / m[i]);
    }
  }
  let d = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${xs[i] + h},${ys[i] + tan[i] * h},${xs[i + 1] - h},${ys[i + 1] - tan[i + 1] * h},${xs[i + 1]},${ys[i + 1]}`;
  }
  return d;
}

const M = { l: 58, r: 14, t: 14, b: 26 };

const dayLabel = (sec: number): string => fmtMonthDay(new Date(sec * 1000));

/**
 * Hand-drawn SVG area chart of the bank balance with gridlines and a hover tooltip. Every colour
 * is a theme token (the accent for the line and its fill, the text and stroke tokens for the
 * axes), so it follows dark / light, the user's accent and the three shell styles by itself.
 */
export default function BalanceChart({ points, clock24, height = 190 }: { points: BalancePoint[]; clock24: boolean; height?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useWidth(wrapRef);
  const [hover, setHover] = useState<number | null>(null);
  const gid = 'bk-fill-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');

  const geo = useMemo(() => {
    if (width <= 0 || points.length < 2) return null;
    const pw = Math.max(10, width - M.l - M.r);
    const ph = Math.max(10, height - M.t - M.b);
    const vs = points.map(p => p.v);
    const { lo, hi, ticks } = niceTicks(Math.min(...vs), Math.max(...vs), ph < 150 ? 3 : 4);
    let t0 = points[0].t;
    let t1 = points[points.length - 1].t;
    if (t1 - t0 < 1) {
      t0 -= 3600;
      t1 += 3600;
    }
    const x = (sec: number) => M.l + ((sec - t0) / (t1 - t0)) * pw;
    const y = (v: number) => M.t + (1 - (v - lo) / (hi - lo || 1)) * ph;
    const xs = points.map(p => Math.round(x(p.t) * 10) / 10);
    const ys = points.map(p => Math.round(y(p.v) * 10) / 10);
    const line = monotonePath(xs, ys);
    const bottom = M.t + ph;
    const area = `${line}L${xs[xs.length - 1]},${bottom}L${xs[0]},${bottom}Z`;
    const labelCount = Math.max(2, Math.min(6, Math.floor(pw / 110)));
    const longSpan = t1 - t0 > 2 * 86400;
    const xLabels = Array.from({ length: labelCount }, (_, i) => {
      const sec = t0 + ((t1 - t0) * i) / (labelCount - 1);
      return {
        x: x(sec),
        text: longSpan ? dayLabel(sec) : fmtTime(new Date(sec * 1000), clock24),
        anchor: (i === 0 ? 'start' : i === labelCount - 1 ? 'end' : 'middle') as 'start' | 'end' | 'middle',
      };
    });
    return { xs, ys, line, area, bottom, ticks: ticks.map(v => ({ v, y: y(v) })), xLabels };
  }, [width, height, points, clock24]);

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!geo) return;
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let best = 0;
    for (let i = 1; i < geo.xs.length; i++) if (Math.abs(geo.xs[i] - px) < Math.abs(geo.xs[best] - px)) best = i;
    setHover(best);
  };

  // (a refresh can swap in a shorter statement while the pointer rests on the chart)
  const hp = hover !== null && geo ? points[hover] ?? null : null;
  const hx = hp && geo && hover !== null ? geo.xs[hover] : 0;
  const hy = hp && geo && hover !== null ? geo.ys[hover] : 0;
  const when = hp ? new Date(hp.t * 1000) : null;

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      {geo && (
        <svg width={width} height={height} className="block" role="img" aria-label={t('ui.bank.chart_title')} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--accent-fill)', stopOpacity: 0.34 }} />
              <stop offset="100%" style={{ stopColor: 'var(--accent-fill)', stopOpacity: 0 }} />
            </linearGradient>
          </defs>

          {geo.ticks.map(tk => (
            <g key={tk.v}>
              <line x1={M.l} x2={width - M.r} y1={tk.y} y2={tk.y} className="stroke-stroke-strong" strokeWidth={1} shapeRendering="crispEdges" />
              <text x={M.l - 10} y={tk.y} dy="0.35em" textAnchor="end" className="fill-t3 text-[11px] tabular-nums">
                {fmtCompactMoney(tk.v)}
              </text>
            </g>
          ))}
          {geo.xLabels.map((l, i) => (
            <text key={i} x={l.x} y={height - 6} textAnchor={l.anchor} className="fill-t3 text-[11px]">
              {l.text}
            </text>
          ))}

          <path d={geo.area} fill={`url(#${gid})`} />
          <path d={geo.line} fill="none" className="stroke-accent" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {hp && (
            <g pointerEvents="none">
              <line x1={hx} x2={hx} y1={M.t} y2={geo.bottom} className="stroke-t3" strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={hx} cy={hy} r={5} className="fill-accent stroke-layer" strokeWidth={2} />
            </g>
          )}
        </svg>
      )}

      {hp && when && (
        <div
          className="absolute pointer-events-none acrylic shadow-flyout rounded-ctl px-3 py-2 min-w-[150px] z-10 fade-in transition-[left,top,transform] duration-100 ease-out"
          style={{
            left: Math.max(84, Math.min(hx, width - 84)),
            top: hy,
            transform: hy < 80 ? 'translate(-50%, 14px)' : 'translate(-50%, calc(-100% - 14px))',
          }}
        >
          <div className="text-body font-semibold text-t1 tabular-nums">{fmtMoney(hp.v)}</div>
          <div className="text-caption text-t2 truncate max-w-[220px]">
            {hp.label}
            {hp.delta !== undefined && <span className={hp.delta < 0 ? 'text-critical' : 'text-success'}> {fmtSigned(hp.delta)}</span>}
          </div>
          <div className="text-caption text-t3">
            {dayLabel(hp.t)}, {fmtTime(when, clock24)}
          </div>
        </div>
      )}
    </div>
  );
}
