import type { ReactNode, SVGProps } from 'react';

// The games' own drawings. Each takes the current text colour, so the caller picks it with
// `color` (or, for a playing card, the card's ink).

/**
 * Playing-card colours. A card face is its own light surface in every theme, like a real card on
 * any table, so these are fixed: they are what the card shows, not part of the window.
 */
export const PAPER = '#fbfaf6';
export const INK = '#1b1b1f';
export const RED = '#c5221f';
export const CARD_EDGE = 'rgba(0, 0, 0, 0.3)';

type GlyphProps = { size: number } & Omit<SVGProps<SVGSVGElement>, 'width' | 'height'>;

/** A mine: a round body with eight short spikes. */
export function MineGlyph({ size, ...rest }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...rest}>
      <path d="M12 2.5V21.5M2.5 12H21.5M5.3 5.3L18.7 18.7M18.7 5.3L5.3 18.7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="6.2" fill="currentColor" />
      <circle cx="9.9" cy="9.9" r="1.6" fill="#fff" opacity="0.55" />
    </svg>
  );
}

/** A flag: the pennant takes the text colour, the pole and foot stay steel. */
export function FlagGlyph({ size, ...rest }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...rest}>
      <path d="M8 3.5V20.5M4.5 20.5H12.5" fill="none" stroke="#e6ebf0" strokeWidth="2" strokeLinecap="round" />
      <path d="M9.2 4L19.5 8.4L9.2 12.8Z" fill="currentColor" />
    </svg>
  );
}

/** The four suits on a 24 x 24 grid, in suit order: spade, heart, diamond, club. */
const SUITS: ReactNode[] = [
  <path
    key="spade"
    d="M12 2C8.4 6.6 3 9.8 3 14.3C3 16.9 5 18.8 7.4 18.8C8.9 18.8 10.2 18.1 11.1 17C10.9 19 10.2 20.6 9 22L15 22C13.8 20.6 13.1 19 12.9 17C13.8 18.1 15.1 18.8 16.6 18.8C19 18.8 21 16.9 21 14.3C21 9.8 15.6 6.6 12 2Z"
  />,
  <path
    key="heart"
    d="M12 21.5C5.6 16 2 12.2 2 8.2C2 5.2 4.3 3 7.1 3C9.1 3 10.9 4.1 12 5.9C13.1 4.1 14.9 3 16.9 3C19.7 3 22 5.2 22 8.2C22 12.2 18.4 16 12 21.5Z"
  />,
  <path key="diamond" d="M12 2L19.5 12L12 22L4.5 12Z" />,
  <g key="club">
    <circle cx="12" cy="6.8" r="4.3" />
    <circle cx="7.3" cy="13.2" r="4.3" />
    <circle cx="16.7" cy="13.2" r="4.3" />
    <circle cx="12" cy="11.5" r="2.6" />
    <path d="M12 12C11.8 16.5 11 19.6 9 22L15 22C13 19.6 12.2 16.5 12 12Z" />
  </g>,
];

/** A card suit: 0 spade, 1 heart, 2 diamond, 3 club. */
export function SuitGlyph({ suit, size, ...rest }: GlyphProps & { suit: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...rest}>
      {SUITS[suit]}
    </svg>
  );
}
