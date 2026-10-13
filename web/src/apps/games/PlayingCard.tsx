import { memo } from 'react';
import { INK, RED, SuitGlyph } from './glyphs';
import { cx } from './shared';

const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** `picked`: in the player's hand. `target`: a place the picked card may go. */
export type Mark = 'none' | 'picked' | 'target';

interface Props {
  id: number;
  rank: number;
  suit: number;
  up: boolean;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  mark: Mark;
  /** The card was clicked with nowhere to go: it shakes its head once. */
  refused: boolean;
  /** Buried in a squared-up pile (the stock, the waste, a foundation): it casts no shadow of its own, or two dozen of them would make one black halo. */
  flat: boolean;
}

/**
 * One card on the table. It is the same element for the whole game and is only ever given a new
 * place, so a move is its left/top easing across the felt.
 */
export const PlayingCard = memo(function PlayingCard({ id, rank, suit, up, x, y, z, w, h, mark, refused, flat }: Props) {
  return (
    <div data-card={id} className={cx('sl-card', flat && 'is-flat', mark === 'picked' && 'is-picked', mark === 'target' && 'is-target', refused && 'is-refused')} style={{ left: x, top: y, width: w, height: h, zIndex: z }}>
      {up ? <Face rank={rank} suit={suit} w={w} /> : <Back w={w} />}
    </div>
  );
});

/**
 * The face: ivory paper, rank and suit in two corners, read from either end, and the suit large
 * in the middle. Jack, queen and king carry their letter in a double frame instead of a portrait.
 * Rank and suit sit side by side so both still show in the narrow strip left when a long pile
 * closes up.
 */
function Face({ rank, suit, w }: { rank: number; suit: number; w: number }) {
  const text = Math.max(11, Math.min(22, Math.round(w * 0.23)));
  const edge = Math.max(2, Math.round(w * 0.06));
  const corner = (
    <>
      <span>{RANKS[rank]}</span>
      <SuitGlyph suit={suit} size={Math.round(text * 0.78)} />
    </>
  );
  return (
    <div className="sl-face fade-in" style={{ color: suit === 1 || suit === 2 ? RED : INK }}>
      <div className="absolute inset-0 flex items-center justify-center">
        {rank > 10 ? (
          <div className="flex flex-col items-center justify-center gap-1" style={{ width: '56%', height: '56%', border: '1px solid currentColor', outline: '1px solid currentColor', outlineOffset: 2, borderRadius: 3, fontSize: Math.round(w * 0.34) }}>
            <span>{RANKS[rank]}</span>
            <SuitGlyph suit={suit} size={Math.round(w * 0.2)} />
          </div>
        ) : (
          <SuitGlyph suit={suit} size={Math.round(w * (rank === 1 ? 0.56 : 0.44))} />
        )}
      </div>
      <div className="absolute flex items-center gap-px" style={{ left: edge, top: edge, fontSize: text }}>
        {corner}
      </div>
      <div className="absolute flex items-center gap-px rotate-180" style={{ right: edge, bottom: edge, fontSize: text }}>
        {corner}
      </div>
    </div>
  );
}

/** The back: a paper margin round a crimson panel with a gold lattice, and a medallion set in it. */
function Back({ w }: { w: number }) {
  const edge = Math.max(2, Math.round(w * 0.06));
  const stone = Math.round(w * 0.3);
  return (
    <div className="sl-back">
      <div style={{ left: edge, top: edge, right: edge, bottom: edge }}>
        <span className="flex items-center justify-center rotate-45" style={{ width: stone, height: stone, border: '1px solid #f1d88a', background: '#7d1526' }}>
          <span style={{ width: '42%', height: '42%', background: '#f1d88a' }} />
        </span>
      </div>
    </div>
  );
}
