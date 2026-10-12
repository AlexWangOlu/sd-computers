import { useId, type ReactElement } from 'react';
import type { WinApp } from '@/store/os';

// Colourful Fluent-style app icons, drawn as SVG so nothing ships as an image file. Gradient ids go
// through useId() - the same icon renders many times at once (taskbar, start, desktop, titlebar).

interface IconProps {
  size?: number;
}

/** Points of a gear outline: `teeth` square-ish cogs between rInner and rOuter. */
const gearPath = (cx: number, cy: number, rOuter: number, rInner: number, teeth: number): string => {
  const pts: string[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const angles = [a - step * 0.22, a - step * 0.14, a + step * 0.14, a + step * 0.22];
    const radii = [rInner, rOuter, rOuter, rInner];
    angles.forEach((ang, k) => pts.push(`${(cx + Math.cos(ang) * radii[k]).toFixed(2)},${(cy + Math.sin(ang) * radii[k]).toFixed(2)}`));
  }
  return `M${pts.join('L')}Z`;
};

const GEAR = gearPath(24, 24, 19, 15, 9);

function MailIcon({ size = 24 }: IconProps) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6cc4ff" />
          <stop offset="1" stopColor="#0a5fd6" />
        </linearGradient>
      </defs>
      <rect x="4" y="10" width="40" height="29" rx="4.5" fill={`url(#${id}a)`} />
      <path d="M6 14l18 12.5L42 14" fill="none" stroke="#eaf4ff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LogsIcon({ size = 24 }: IconProps) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2f6fb" />
          <stop offset="1" stopColor="#b7c4d8" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd75e" />
          <stop offset="1" stopColor="#f29a00" />
        </linearGradient>
      </defs>
      <rect x="8" y="5" width="28" height="37" rx="3.5" fill={`url(#${id}a)`} />
      <rect x="13" y="12" width="18" height="2.6" rx="1.3" fill="#62758f" />
      <rect x="13" y="18" width="18" height="2.6" rx="1.3" fill="#62758f" />
      <rect x="13" y="24" width="11" height="2.6" rx="1.3" fill="#62758f" />
      <path d="M34 25l10 17H24z" fill={`url(#${id}b)`} stroke="#c97b00" strokeWidth="0.8" strokeLinejoin="round" />
      <rect x="32.9" y="30.5" width="2.2" height="6" rx="1.1" fill="#3b2a00" />
      <circle cx="34" cy="39.3" r="1.3" fill="#3b2a00" />
    </svg>
  );
}

function CmdIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <rect x="4" y="8" width="40" height="33" rx="4.5" fill="#1a1a1a" stroke="#5a5a5a" strokeWidth="1.2" />
      <path d="M4.6 14h38.8" stroke="#3a3a3a" strokeWidth="1.2" />
      <path d="M12 21.5l7 5-7 5" fill="none" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22.5 33h11" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

function BossIcon({ size = 24 }: IconProps) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#43e3c1" />
          <stop offset="1" stopColor="#088c77" />
        </linearGradient>
      </defs>
      <path d="M17 15v-3.5A2.5 2.5 0 0 1 19.5 9h9a2.5 2.5 0 0 1 2.5 2.5V15" fill="none" stroke="#0a6b5c" strokeWidth="3" />
      <rect x="5" y="15" width="38" height="26" rx="4.5" fill={`url(#${id}a)`} />
      <rect x="5" y="25" width="38" height="2.6" fill="rgba(0,0,0,0.18)" />
      <rect x="20.5" y="22" width="7" height="8" rx="1.6" fill="#ecfffb" />
    </svg>
  );
}

function NotepadIcon({ size = 24 }: IconProps) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2a8" />
          <stop offset="1" stopColor="#ffd84d" />
        </linearGradient>
      </defs>
      <rect x="9" y="9" width="30" height="34" rx="2.5" fill={`url(#${id}a)`} />
      <rect x="9" y="5" width="30" height="7" rx="2.5" fill="#c0392b" />
      <path d="M15 9v34" stroke="#e57373" strokeWidth="1.2" />
      {[19, 24, 29, 34, 39].map(y => (
        <rect key={y} x="17.5" y={y} width={y === 39 ? 10 : 17} height="1.6" rx="0.8" fill="#9aa7c7" />
      ))}
    </svg>
  );
}

/** Messages (phone link): a green speech bubble with a typing ellipsis. */
function MessagesIcon({ size = 24 }: IconProps) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6ee87a" />
          <stop offset="1" stopColor="#1fae3c" />
        </linearGradient>
      </defs>
      <path d="M24 7C13.5 7 6 13.6 6 21.6c0 4.6 2.5 8.6 6.4 11.2L10.6 41l8.3-4.7c1.6.4 3.3.6 5.1.6 10.5 0 18-6.6 18-15.3S34.5 7 24 7z" fill={`url(#${id}a)`} />
      {[16.5, 24, 31.5].map(x => (
        <circle key={x} cx={x} cy="21.6" r="2.6" fill="#ffffff" />
      ))}
    </svg>
  );
}

/** Notes (phone link): a white card with an amber header band and a pencil stroke. */
function NotesIcon({ size = 24 }: IconProps) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffc94a" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect x="7" y="6" width="34" height="36" rx="5" fill="#fbfaf6" stroke="#d9d4c4" strokeWidth="1" />
      <path d="M7 11a5 5 0 0 1 5-5h24a5 5 0 0 1 5 5v4H7z" fill={`url(#${id}a)`} />
      {[22, 27.5, 33].map(y => (
        <rect key={y} x="12" y={y} width={y === 33 ? 13 : 24} height="1.8" rx="0.9" fill="#c9c3b3" />
      ))}
      <path d="M30 36.5l8.5-8.5 2.6 2.6-8.5 8.5-3.4.8z" fill="#f59e0b" stroke="#b86e00" strokeWidth="0.8" strokeLinejoin="round" />
    </svg>
  );
}

function CalculatorIcon({ size = 24 }: IconProps) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#61666e" />
          <stop offset="1" stopColor="#2c2f34" />
        </linearGradient>
      </defs>
      <rect x="9" y="4" width="30" height="40" rx="4.5" fill={`url(#${id}a)`} />
      <rect x="13" y="9" width="22" height="8" rx="1.6" fill="#cfeaf8" />
      {[0, 1, 2].map(r =>
        [0, 1, 2].map(c => (
          <rect
            key={`${r}${c}`}
            x={13 + c * 7.6}
            y={21 + r * 7.2}
            width="5.6"
            height="5.2"
            rx="1.2"
            fill={r === 2 && c === 2 ? '#ff8c1a' : '#d9dce1'}
          />
        )),
      )}
    </svg>
  );
}

function SettingsIcon({ size = 24 }: IconProps) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a9b4c4" />
          <stop offset="1" stopColor="#56627a" />
        </linearGradient>
      </defs>
      <path d={GEAR} fill={`url(#${id}a)`} />
      <circle cx="24" cy="24" r="6.4" fill="#2b3240" />
      <circle cx="24" cy="24" r="3.4" fill="#9fb0c8" />
    </svg>
  );
}

function HackIcon({ size = 24 }: IconProps) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f3a17" />
          <stop offset="1" stopColor="#0a1508" />
        </linearGradient>
      </defs>
      <path d="M24 4l16 6v12c0 10-7 18-16 22C15 40 8 32 8 22V10z" fill={`url(#${id}a)`} stroke="#88e52b" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="24" cy="20" r="4.2" fill="#88e52b" />
      <rect x="22.4" y="22" width="3.2" height="9" rx="1.2" fill="#88e52b" />
    </svg>
  );
}

function SystemIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <rect x="5" y="9" width="38" height="25" rx="3" fill="#3a8ee6" />
      <rect x="8" y="12" width="32" height="19" rx="1.5" fill="#bfe1ff" />
      <rect x="18" y="35" width="12" height="3" fill="#7d8796" />
      <rect x="13" y="38" width="22" height="3" rx="1.5" fill="#9aa4b2" />
    </svg>
  );
}

const ICONS: Record<WinApp | 'system', (p: IconProps) => ReactElement> = {
  mail: MailIcon,
  logs: LogsIcon,
  cmd: CmdIcon,
  boss: BossIcon,
  notepad: NotepadIcon,
  calculator: CalculatorIcon,
  settings: SettingsIcon,
  messages: MessagesIcon,
  notes: NotesIcon,
  hack: HackIcon,
  system: SystemIcon,
};

/** An app's icon by id (falls back to the generic system icon). */
export function AppIcon({ app, size = 24 }: { app: WinApp | 'system'; size?: number }) {
  const Icon = ICONS[app] ?? SystemIcon;
  return <Icon size={size} />;
}

/**
 * The SD OS mark (Start button, boot screen, Settings > About): a gradient tile with an open
 * orbit ring and a satellite dot. Original artwork - no third-party logo anywhere in the OS.
 */
export function OsLogo({ size = 24 }: IconProps) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3fe0d0" />
          <stop offset="0.55" stopColor="#4f8dff" />
          <stop offset="1" stopColor="#8b5cff" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="12" fill={`url(#${id}a)`} />
      <path d="M33.9 16.5A12 12 0 1 0 35.4 28" fill="none" stroke="#ffffff" strokeWidth="4.2" strokeLinecap="round" />
      <circle cx="34.2" cy="21.6" r="3.1" fill="#ffffff" />
    </svg>
  );
}

/** Round initials avatar on an accent gradient. */
export function Avatar({ initials, size = 32 }: { initials: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-semibold text-white shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: 'linear-gradient(135deg, var(--accent), #2b2f6b)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)',
      }}
    >
      {initials}
    </div>
  );
}

// Thin 10px caption glyphs for the title bar buttons.
export const GlyphMin = () => (
  <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 5.5h10" stroke="currentColor" strokeWidth="1" /></svg>
);
export const GlyphMax = () => (
  <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1" /></svg>
);
export const GlyphRestore = () => (
  <svg width="10" height="10" viewBox="0 0 10 10">
    <rect x="0.5" y="2.5" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1" />
    <path d="M2.5 2.5V1.8A1.3 1.3 0 0 1 3.8 0.5h4.4a1.3 1.3 0 0 1 1.3 1.3v4.4a1.3 1.3 0 0 1-1.3 1.3H7.5" fill="none" stroke="currentColor" strokeWidth="1" />
  </svg>
);
export const GlyphClose = () => (
  <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0.5 0.5l9 9M9.5 0.5l-9 9" stroke="currentColor" strokeWidth="1" /></svg>
);
