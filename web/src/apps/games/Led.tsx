// A seven-segment readout, as on the front of a piece of equipment: every digit is seven bars,
// lit or not. Drawn, not typeset - a font would not have the unlit bars showing behind the lit
// ones, which is most of what makes one of these look like one.

/** Which bars each character lights: a top, b top right, c bottom right, d bottom, e bottom left, f top left, g middle. */
const LIT: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abdeg',
  '3': 'abcdg',
  '4': 'bcfg',
  '5': 'acdfg',
  '6': 'acdefg',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
  ' ': '',
};

/** Each bar on a 12 x 22 digit: slim hexagons, so neighbours meet at a point as real ones do. */
const BARS: Record<string, string> = {
  a: '2.6,1 9.4,1 10.6,2.2 9.4,3.4 2.6,3.4 1.4,2.2',
  g: '2.6,9.8 9.4,9.8 10.6,11 9.4,12.2 2.6,12.2 1.4,11',
  d: '2.6,18.6 9.4,18.6 10.6,19.8 9.4,21 2.6,21 1.4,19.8',
  f: '1,2.8 2.2,4 2.2,9.2 1,10.4 -0.2,9.2 -0.2,4',
  b: '11,2.8 12.2,4 12.2,9.2 11,10.4 9.8,9.2 9.8,4',
  e: '1,11.6 2.2,12.8 2.2,18 1,19.2 -0.2,18 -0.2,12.8',
  c: '11,11.6 12.2,12.8 12.2,18 11,19.2 9.8,18 9.8,12.8',
};

/** `text` on a readout, `height` px tall. Anything that is not a digit, a minus or a colon is a blank digit. */
export function Led({ text, height = 28, color = '#ffb000' }: { text: string; height?: number; color?: string }) {
  const w = Math.round((height * 12.4) / 22);
  return (
    <>
      {text.split('').map((ch, i) => {
        if (ch === ':') {
          return (
            <svg key={i} width={Math.round(w * 0.4)} height={height} viewBox="0 0 5 22" aria-hidden>
              <rect x="1.4" y="6" width="2.2" height="2.2" fill={color} />
              <rect x="1.4" y="14" width="2.2" height="2.2" fill={color} />
            </svg>
          );
        }
        const lit = LIT[ch] ?? '';
        return (
          <svg key={i} width={w} height={height} viewBox="-0.4 0 12.8 22" aria-hidden>
            {Object.keys(BARS).map(bar => (
              <polygon key={bar} points={BARS[bar]} fill={color} opacity={lit.includes(bar) ? 1 : 0.1} />
            ))}
          </svg>
        );
      })}
    </>
  );
}
