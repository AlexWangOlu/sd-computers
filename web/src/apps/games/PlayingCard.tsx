import { memo } from 'react';
import { CARD_EDGE, INK, PAPER, RED, SuitGlyph } from './glyphs';
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
  /** The card was clicked with nowhere to go: it blinks once to say so. */
  refused: boolean;
}

/**
 * One card on the table. It is the same element for the whole game and is only ever given a new
 * place, so a move is its left/top easing across (the transition-* class is what lets retro, which
 * switches every transition off, put it straight down instead).
 */
export const PlayingCard = memo(function PlayingCard({ id, rank, suit, up, x, y, z, w, h, mark, refused }: Props) {
  return (
    <div
      data-card={id}
      className={cx(
        'absolute rounded-md shadow-card transition-[left,top] duration-200 ease-out',
        mark === 'picked' && 'outline outline-2 outline-accent',
        mark === 'target' && 'outline-dashed outline-2 outline-accent',
        // pop-in rather than a shake: retro switches it off with the rest of the motion classes.
        refused && 'pop-in',
      )}
      style={{ left: x, top: y, width: w, height: h, zIndex: z }}
    >
      {up ? <Face rank={rank} suit={suit} w={w} /> : <Back w={w} />}
    </div>
  );
});

/**
 * The face: rank and suit in two corners, read from either end, and the suit large in the middle.
 * Jack, queen and king carry their letter in a frame instead of a portrait. Rank and suit sit side
 * by side so both still show in the narrow strip left when a long pile closes up.
 */
function Face({ rank, suit, w }: { rank: number; suit: number; w: number }) {
  const text = Math.max(10, Math.min(20, Math.round(w * 0.21)));
  const edge = Math.max(2, Math.round(w * 0.06));
  const corner = (
    <>
      <span>{RANKS[rank]}</span>
      <SuitGlyph suit={suit} size={Math.round(text * 0.8)} />
    </>
  );
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[inherit] border fade-in" style={{ background: PAPER, borderColor: CARD_EDGE, color: suit === 1 || suit === 2 ? RED : INK }}>
      <div className="absolute inset-0 flex items-center justify-center">
        {rank > 10 ? (
          <div className="flex flex-col items-center justify-center gap-0.5 rounded-sm border border-current font-bold leading-none" style={{ width: '54%', height: '52%', fontSize: Math.round(w * 0.3) }}>
            <span>{RANKS[rank]}</span>
            <SuitGlyph suit={suit} size={Math.round(w * 0.2)} />
          </div>
        ) : (
          <SuitGlyph suit={suit} size={Math.round(w * 0.44)} />
        )}
      </div>
      <div className="absolute flex items-center gap-px font-bold leading-none" style={{ left: edge, top: edge, fontSize: text }}>
        {corner}
      </div>
      <div className="absolute flex items-center gap-px font-bold leading-none rotate-180" style={{ right: edge, bottom: edge, fontSize: text }}>
        {corner}
      </div>
    </div>
  );
}

/** Two crossed sets of fine lines, one light and one dark, so the weave shows on any accent. */
const WEAVE =
  'repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.3) 0 1.5px, transparent 1.5px 7px), ' +
  'repeating-linear-gradient(-45deg, rgba(0, 0, 0, 0.18) 0 1.5px, transparent 1.5px 7px)';

/** The back: a paper margin round a woven panel in the user's accent, with a small stone set in it. */
function Back({ w }: { w: number }) {
  const edge = Math.max(2, Math.round(w * 0.055));
  const stone = Math.round(w * 0.26);
  return (
    <div className="absolute inset-0 rounded-[inherit] border" style={{ background: PAPER, borderColor: CARD_EDGE }}>
      <div className="absolute flex items-center justify-center overflow-hidden rounded-sm bg-accent" style={{ left: edge, top: edge, right: edge, bottom: edge, backgroundImage: WEAVE }}>
        <div className="flex items-center justify-center rotate-45 rounded-sm" style={{ width: stone, height: stone, background: PAPER }}>
          <div className="h-2/5 w-2/5 rounded-full bg-accent" />
        </div>
      </div>
    </div>
  );
}
