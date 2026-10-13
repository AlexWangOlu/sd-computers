import type { CSSProperties } from 'react';
import { CARD_EDGE, FlagGlyph, INK, PAPER, RED, SuitGlyph } from './glyphs';

// The small pictures on the launcher's tiles: a corner of each game, drawn from the same tokens and
// glyphs the games use, so they follow the theme and the accent like the real boards do.

const fill = (v: string): CSSProperties => ({ fill: v });
const CARD: CSSProperties = { fill: PAPER, stroke: CARD_EDGE };

export function MinesPreview() {
  // c covered, f flagged, o open and empty, a digit for an open number.
  const rows = ['ccfcc', 'c112c', 'ooo1c'];
  const tone: Record<string, string> = { '1': 'var(--accent-text)', '2': 'var(--success)' };
  return (
    <svg viewBox="0 0 112 68" className="h-full max-w-full" aria-hidden="true">
      {rows.map((row, y) =>
        row.split('').map((k, x) => {
          const px = 2 + x * 22;
          const py = 2 + y * 22;
          const covered = k === 'c' || k === 'f';
          return (
            <g key={`${x}.${y}`}>
              <rect x={px} y={py} width="20" height="20" rx="3" style={covered ? { fill: 'var(--text-3)', opacity: 0.4 } : { fill: 'none', stroke: 'var(--stroke-strong)' }} />
              {k === 'f' && <FlagGlyph size={14} x={px + 3} y={py + 3} className="text-critical" />}
              {tone[k] && (
                <text x={px + 10} y={py + 14.5} textAnchor="middle" fontSize="12" fontWeight="700" style={fill(tone[k])}>
                  {k}
                </text>
              )}
            </g>
          );
        }),
      )}
    </svg>
  );
}

export function SolitairePreview() {
  return (
    <svg viewBox="0 0 120 68" className="h-full max-w-full" aria-hidden="true">
      <g transform="rotate(-14 38 36)">
        <rect x="22" y="11" width="32" height="46" rx="4" style={CARD} />
        <rect x="25" y="14" width="26" height="40" rx="2" style={fill('var(--accent-fill)')} />
      </g>
      <rect x="44" y="8" width="32" height="46" rx="4" style={CARD} />
      <SuitGlyph suit={0} size={18} x={51} y={22} style={{ color: INK }} />
      <g transform="rotate(14 82 36)">
        <rect x="66" y="11" width="32" height="46" rx="4" style={CARD} />
        <SuitGlyph suit={1} size={18} x={73} y={25} style={{ color: RED }} />
      </g>
    </svg>
  );
}

export function SnakePreview() {
  // Tail first, on a board of 11 x 6 cells of 10.
  const body = [
    [1, 4],
    [2, 4],
    [3, 4],
    [4, 4],
    [4, 3],
    [4, 2],
    [5, 2],
    [6, 2],
  ];
  return (
    <svg viewBox="0 0 120 68" className="h-full max-w-full" aria-hidden="true">
      <rect x="5" y="4" width="110" height="60" rx="4" style={{ fill: 'rgba(0, 0, 0, 0.1)', stroke: 'var(--stroke-strong)' }} />
      {body.map(([x, y]) => (
        <rect key={`${x}.${y}`} x={6 + x * 10} y={5 + y * 10} width="8" height="8" rx="2" style={fill('var(--accent-fill)')} />
      ))}
      <circle cx={10 + 9 * 10} cy={9 + 2 * 10} r="3" style={fill('var(--critical)')} />
    </svg>
  );
}
