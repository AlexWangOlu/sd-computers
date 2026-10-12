import { memo, useId } from 'react';
import { mix } from './theme';
import { retroWallpaper } from './retro/wallpapers';
import { macWallpaper } from './mac/wallpapers';

// Wallpapers drawn as SVG at 1920x1080 and scaled with "slice" (cover), so the resource ships no
// image files. Any wallpaper id that isn't one of these is treated as an image URL.

const W = 1920;
const H = 1080;

/** Petals: a twelve-petal teal/violet rosette (two alternating petal lengths) off to the right. */
function Petals({ light }: { light: boolean }) {
  const id = useId();
  const cx = 1240;
  const cy = 600;
  const outer = Array.from({ length: 12 }, (_, i) => i * 30 + 6);
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={`${id}bg`} cx="0.64" cy="0.56" r="0.8">
          <stop offset="0" stopColor={light ? '#f4effc' : '#24164a'} />
          <stop offset="0.55" stopColor={light ? '#ddd5f3' : '#0f0b26'} />
          <stop offset="1" stopColor={light ? '#c2b6e6' : '#05040e'} />
        </radialGradient>
        <linearGradient id={`${id}p`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={light ? '#7b4dff' : '#8b5cff'} stopOpacity="0.9" />
          <stop offset="0.6" stopColor={light ? '#36c9d6' : '#2fd4c8'} stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.05" />
        </linearGradient>
        <radialGradient id={`${id}core`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={light ? '#ffffff' : '#c9fff6'} stopOpacity={light ? 0.95 : 0.6} />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}blur`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}bg)`} />
      <g filter={`url(#${id}blur)`} opacity={light ? 0.85 : 0.95}>
        {outer.map((a, i) => {
          const long = i % 2 === 0;
          return (
            <ellipse
              key={a}
              cx={cx + (long ? 230 : 150)}
              cy={cy}
              rx={long ? 250 : 165}
              ry={long ? 54 : 40}
              fill={`url(#${id}p)`}
              transform={`rotate(${a} ${cx} ${cy})`}
            />
          );
        })}
      </g>
      <circle cx={cx} cy={cy} r="90" fill={`url(#${id}core)`} />
    </svg>
  );
}

/** Nebula: soft overlapping colour clouds on near-black. */
function Nebula() {
  const id = useId();
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <filter id={`${id}b`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="120" />
        </filter>
      </defs>
      <rect width={W} height={H} fill="#090616" />
      <g filter={`url(#${id}b)`}>
        <circle cx="520" cy="360" r="320" fill="#6b2bd9" opacity="0.85" />
        <circle cx="1350" cy="700" r="380" fill="#1f5fe0" opacity="0.8" />
        <circle cx="1080" cy="260" r="240" fill="#d6338f" opacity="0.55" />
        <circle cx="300" cy="900" r="260" fill="#0aa7b8" opacity="0.45" />
      </g>
    </svg>
  );
}

/** Dusk: a warm gradient sky over layered hills. */
function Dusk() {
  const id = useId();
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#24164a" />
          <stop offset="0.45" stopColor="#b6406f" />
          <stop offset="0.8" stopColor="#f59a5a" />
          <stop offset="1" stopColor="#ffd08a" />
        </linearGradient>
        <radialGradient id={`${id}sun`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset="1" stopColor="#ffb36b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}s)`} />
      <circle cx="1240" cy="760" r="260" fill={`url(#${id}sun)`} />
      <path d="M0 820 C 300 700 520 760 800 720 S 1400 640 1920 760 V1080 H0Z" fill="#5a2350" opacity="0.85" />
      <path d="M0 900 C 380 820 700 900 1000 860 S 1600 820 1920 900 V1080 H0Z" fill="#3a1638" />
      <path d="M0 980 C 400 930 800 990 1200 950 S 1700 940 1920 980 V1080 H0Z" fill="#1f0b22" />
    </svg>
  );
}

/** Currents: flowing teal wave lines. */
function Currents() {
  const id = useId();
  const waves = Array.from({ length: 9 }, (_, i) => i);
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#03161a" />
          <stop offset="1" stopColor="#062c33" />
        </linearGradient>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#00e5c8" stopOpacity="0" />
          <stop offset="0.5" stopColor="#00c9d6" stopOpacity="0.9" />
          <stop offset="1" stopColor="#3b7cff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}bg)`} />
      {waves.map(i => {
        const y = 300 + i * 52;
        const amp = 120 + i * 14;
        return (
          <path
            key={i}
            d={`M-100 ${y} C 400 ${y - amp}, 800 ${y + amp}, 1200 ${y - amp / 2} S 1800 ${y + amp / 2}, 2100 ${y - 40}`}
            fill="none"
            stroke={`url(#${id}w)`}
            strokeWidth={3 + (i % 3) * 2}
            opacity={0.25 + (i % 4) * 0.15}
          />
        );
      })}
    </svg>
  );
}

/**
 * The desktop/lock screen background for a wallpaper id. Known ids are generated; anything else is
 * shown as an image URL (cover). `solid` takes the accent, darkened.
 */
export const Wallpaper = memo(function Wallpaper({ id, accent }: { id: string; accent: string }) {
  let inner;
  switch (id) {
    case 'petals-dark':
      inner = <Petals light={false} />;
      break;
    case 'petals-light':
      inner = <Petals light />;
      break;
    case 'nebula':
      inner = <Nebula />;
      break;
    case 'dusk':
      inner = <Dusk />;
      break;
    case 'currents':
      inner = <Currents />;
      break;
    case 'solid':
      inner = <div className="absolute inset-0" style={{ background: mix(accent, '#000000', 0.55) }} />;
      break;
    default:
      // Other styles' generated wallpapers (retro-*, harbor-*), else an image URL.
      inner = retroWallpaper(id, accent) ?? macWallpaper(id, accent) ?? (
        <img src={id} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      );
  }
  return <div className="absolute inset-0 overflow-hidden bg-black">{inner}</div>;
});
