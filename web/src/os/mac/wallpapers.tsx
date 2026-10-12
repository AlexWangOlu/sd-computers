import { useId, type ReactNode } from 'react';

// Harbor's wallpapers: original generated SVG art at 1920x1080, scaled with "slice" (cover).
// Nothing ships as an image file. Ids are listed in configs/shared/desktop.lua Styles.mac.

const W = 1920;
const H = 1080;

function Frame({ children }: { children: ReactNode }) {
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden>
      {children}
    </svg>
  );
}

/** Dunes: warm layered sand ridges under a peach sky, fading from apricot to deep plum. */
function Dunes() {
  const id = useId();
  const ridges: { crest: string; a: string; b: string; rim: number }[] = [
    { crest: 'M0 640 C 220 600 470 585 720 612 S 1210 690 1480 664 S 1800 600 1920 612', a: '#f4ae8d', b: '#e98f80', rim: 0.35 },
    { crest: 'M0 704 C 300 655 560 690 860 724 S 1440 762 1920 690', a: '#e5867c', b: '#cd6777', rim: 0.28 },
    { crest: 'M0 812 C 260 760 600 742 900 790 S 1500 884 1920 792', a: '#c95d79', b: '#9f4674', rim: 0.22 },
    { crest: 'M0 904 C 380 862 700 902 1020 934 S 1620 932 1920 880', a: '#903e74', b: '#672e66', rim: 0.16 },
    { crest: 'M0 1004 C 340 954 760 968 1100 1010 S 1700 1042 1920 1000', a: '#532659', b: '#2d1940', rim: 0.12 },
  ];
  return (
    <Frame>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fdeedd" />
          <stop offset="0.38" stopColor="#f9d2b0" />
          <stop offset="0.62" stopColor="#f3ad8e" />
          <stop offset="1" stopColor="#e88c80" />
        </linearGradient>
        <radialGradient id={`${id}sun`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fffaf0" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="#fff1dc" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffe3c4" stopOpacity="0" />
        </radialGradient>
        {ridges.map((r, i) => (
          <linearGradient key={i} id={`${id}r${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={r.a} />
            <stop offset="1" stopColor={r.b} />
          </linearGradient>
        ))}
      </defs>
      <rect width={W} height={H} fill={`url(#${id}sky)`} />
      <circle cx="1360" cy="560" r="420" fill={`url(#${id}sun)`} />
      {ridges.map((r, i) => (
        <g key={i}>
          <path d={`${r.crest} V${H} H0Z`} fill={`url(#${id}r${i})`} />
          <path d={r.crest} fill="none" stroke="#ffffff" strokeOpacity={r.rim} strokeWidth="2" />
        </g>
      ))}
    </Frame>
  );
}

/** Tide: rolling swells from a pale horizon to deep water, each crest edged with foam. */
function Tide() {
  const id = useId();
  const swells: { crest: string; a: string; b: string; foam: number }[] = [
    { crest: 'M0 446 C 300 426 600 456 960 442 S 1600 424 1920 448', a: '#9ad6e4', b: '#62b4d0', foam: 0.45 },
    { crest: 'M0 524 C 340 474 720 562 1080 522 S 1640 472 1920 522', a: '#5eaecd', b: '#3a8fbc', foam: 0.5 },
    { crest: 'M0 624 C 260 562 640 644 980 612 S 1560 542 1920 602', a: '#3d91c0', b: '#2671a6', foam: 0.5 },
    { crest: 'M0 744 C 380 662 780 784 1160 722 S 1700 652 1920 702', a: '#2b76ad', b: '#1a5590', foam: 0.45 },
    { crest: 'M0 864 C 300 802 700 904 1060 842 S 1620 782 1920 832', a: '#1c5c97', b: '#113e73', foam: 0.4 },
    { crest: 'M0 984 C 420 922 820 1012 1240 962 S 1760 922 1920 952', a: '#134276', b: '#0a274e', foam: 0.32 },
  ];
  return (
    <Frame>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eef8fb" />
          <stop offset="0.6" stopColor="#c4e6f1" />
          <stop offset="1" stopColor="#a3d6e8" />
        </linearGradient>
        <radialGradient id={`${id}sun`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        {swells.map((s, i) => (
          <linearGradient key={i} id={`${id}s${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={s.a} />
            <stop offset="1" stopColor={s.b} />
          </linearGradient>
        ))}
      </defs>
      <rect width={W} height={H} fill={`url(#${id}sky)`} />
      <circle cx="560" cy="300" r="240" fill={`url(#${id}sun)`} />
      {swells.map((s, i) => (
        <g key={i}>
          <path d={`${s.crest} V${H} H0Z`} fill={`url(#${id}s${i})`} />
          <path d={s.crest} fill="none" stroke="#ffffff" strokeOpacity={s.foam * 0.25} strokeWidth="14" />
          <path d={s.crest} fill="none" stroke="#ffffff" strokeOpacity={s.foam} strokeWidth="2.5" />
        </g>
      ))}
    </Frame>
  );
}

/** Deterministic star field (an LCG, so every render and every computer draws the same sky). */
const STARS = (() => {
  let seed = 20261005;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  return Array.from({ length: 150 }, () => ({ x: rnd() * W, y: rnd() * 720, r: 0.6 + rnd() * 1.3, o: 0.25 + rnd() * 0.65 }));
})();

/** Aurora: green-to-violet light ribbons over a starry night and a ridge line. */
function Aurora() {
  const id = useId();
  return (
    <Frame>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#02060f" />
          <stop offset="0.55" stopColor="#071a2c" />
          <stop offset="1" stopColor="#0d2b3d" />
        </linearGradient>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1df2a4" stopOpacity="0" />
          <stop offset="0.28" stopColor="#1df2a4" stopOpacity="0.85" />
          <stop offset="0.62" stopColor="#22d3ee" stopOpacity="0.75" />
          <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4ade80" stopOpacity="0" />
          <stop offset="0.4" stopColor="#4ade80" stopOpacity="0.7" />
          <stop offset="1" stopColor="#2dd4bf" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#a78bfa" stopOpacity="0" />
          <stop offset="0.5" stopColor="#a78bfa" stopOpacity="0.6" />
          <stop offset="1" stopColor="#f472b6" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}soft`} x="-20%" y="-60%" width="140%" height="220%">
          <feGaussianBlur stdDeviation="38" />
        </filter>
        <filter id={`${id}fine`} x="-10%" y="-40%" width="120%" height="180%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}bg)`} />
      {STARS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#ffffff" opacity={s.o} />
      ))}
      <g filter={`url(#${id}soft)`}>
        <path d="M-100 380 C 320 200 700 300 1260 200 S 1700 120 2020 160" fill="none" stroke={`url(#${id}c)`} strokeWidth="90" />
        <path d="M-100 520 C 300 300 700 460 1000 330 S 1600 160 2020 260" fill="none" stroke={`url(#${id}a)`} strokeWidth="120" />
        <path d="M-100 650 C 380 470 760 600 1140 470 S 1700 380 2020 430" fill="none" stroke={`url(#${id}b)`} strokeWidth="70" />
      </g>
      <g filter={`url(#${id}fine)`} opacity="0.55">
        <path d="M-100 505 C 300 285 700 445 1000 315 S 1600 145 2020 245" fill="none" stroke={`url(#${id}a)`} strokeWidth="5" />
        <path d="M-100 640 C 380 460 760 590 1140 460 S 1700 370 2020 420" fill="none" stroke={`url(#${id}b)`} strokeWidth="3" />
      </g>
      <path d="M0 850 L180 770 L300 812 L470 718 L620 790 L760 748 L930 822 L1100 742 L1270 800 L1440 720 L1600 790 L1760 752 L1920 806 V1080 H0Z" fill="#06111c" />
      <path d="M0 930 L150 872 L320 912 L500 846 L680 902 L860 860 L1040 922 L1240 868 L1420 920 L1600 870 L1780 912 L1920 884 V1080 H0Z" fill="#02070d" />
    </Frame>
  );
}

/** Graphite: a dark brushed gradient with soft sheen bands and a faint glow in the accent colour. */
function Graphite({ accent }: { accent: string }) {
  const id = useId();
  return (
    <Frame>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a3c42" />
          <stop offset="0.5" stopColor="#1d1e22" />
          <stop offset="1" stopColor="#111214" />
        </linearGradient>
        <radialGradient id={`${id}hi`} cx="0.18" cy="0.12" r="0.7">
          <stop offset="0" stopColor="#6a6e78" stopOpacity="0.5" />
          <stop offset="1" stopColor="#6a6e78" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}glow`} cx="0.86" cy="0.92" r="0.62">
          <stop offset="0" stopColor={accent} stopOpacity="0.3" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}blur`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="34" />
        </filter>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}bg)`} />
      <rect width={W} height={H} fill={`url(#${id}hi)`} />
      <rect width={W} height={H} fill={`url(#${id}glow)`} />
      <g filter={`url(#${id}blur)`} fill="none" stroke="#ffffff">
        <path d="M-200 820 C 400 560 1000 640 2100 180" strokeOpacity="0.05" strokeWidth="150" />
        <path d="M-200 1020 C 500 780 1200 860 2100 420" strokeOpacity="0.035" strokeWidth="110" />
        <path d="M-200 520 C 300 360 900 380 2100 -40" strokeOpacity="0.03" strokeWidth="90" />
      </g>
    </Frame>
  );
}

/** The mac style's generated wallpapers by id (null = not one of ours). */
export function macWallpaper(id: string, accent: string): ReactNode | null {
  switch (id) {
    case 'harbor-dunes':
      return <Dunes />;
    case 'harbor-tide':
      return <Tide />;
    case 'harbor-aurora':
      return <Aurora />;
    case 'harbor-graphite':
      return <Graphite accent={accent} />;
    default:
      return null;
  }
}
