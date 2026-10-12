import { useId } from 'react';
import type { Level } from './types';

// Event Viewer's own glyphs. The level icons are content (like Windows' stock bitmaps), so they
// carry fixed colours that read on both the dark and the light theme.

/** Information (blue circled i), Warning (yellow triangle !), Error (red circled x), key, padlock. */
export function LevelIcon({ level, size = 14 }: { level: Level; size?: number }) {
  const id = useId();
  switch (level) {
    case 'information':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0">
          <defs>
            <linearGradient id={`${id}i`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#4ba3f5" />
              <stop offset="1" stopColor="#0b63c9" />
            </linearGradient>
          </defs>
          <circle cx="8" cy="8" r="7.2" fill={`url(#${id}i)`} stroke="#0a4f9f" strokeWidth="0.6" />
          <circle cx="8" cy="4.6" r="1.15" fill="#fff" />
          <rect x="6.95" y="6.6" width="2.1" height="5.6" rx="0.6" fill="#fff" />
        </svg>
      );
    case 'warning':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0">
          <path d="M8 1.2 15.2 14.3H.8Z" fill="#fcd116" stroke="#a87a00" strokeWidth="0.8" strokeLinejoin="round" />
          <rect x="7.05" y="5.4" width="1.9" height="5" rx="0.5" fill="#222" />
          <circle cx="8" cy="12.2" r="1" fill="#222" />
        </svg>
      );
    case 'error':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0">
          <defs>
            <linearGradient id={`${id}e`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f2645a" />
              <stop offset="1" stopColor="#c4231b" />
            </linearGradient>
          </defs>
          <circle cx="8" cy="8" r="7.2" fill={`url(#${id}e)`} stroke="#8f1610" strokeWidth="0.6" />
          <path d="M5.3 5.3l5.4 5.4M10.7 5.3l-5.4 5.4" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      );
    case 'success':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0">
          <circle cx="5" cy="8" r="3.6" fill="none" stroke="#c99a06" strokeWidth="2" />
          <path d="M8.4 8h6.6M12.6 8v2.6M14.6 8v2" stroke="#c99a06" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'failure':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0">
          <path d="M4.8 7V5.2a3.2 3.2 0 0 1 6.4 0V7" fill="none" stroke="#8a8f98" strokeWidth="1.7" />
          <rect x="2.8" y="7" width="10.4" height="7.6" rx="1.3" fill="#d6a40c" stroke="#9c7600" strokeWidth="0.6" />
          <rect x="7.3" y="9.3" width="1.4" height="3" rx="0.6" fill="#5c4500" />
        </svg>
      );
  }
}

/** Console-tree glyphs: the snap-in root, folders, a custom view, a log, subscriptions. */
export function NodeIcon({ kind, open }: { kind: 'root' | 'folder' | 'custom' | 'log' | 'sub'; open?: boolean }) {
  switch (kind) {
    case 'root':
      return (
        <svg width={16} height={16} viewBox="0 0 16 16" className="shrink-0">
          <rect x="1.5" y="2" width="11" height="12" rx="1" fill="#e8edf4" stroke="#7d8da3" strokeWidth="0.8" />
          <path d="M3.5 5h7M3.5 7.5h7M3.5 10h4.5" stroke="#62758f" strokeWidth="1.1" />
          <path d="M11.5 8.5 15.2 15H7.8Z" fill="#fcd116" stroke="#a87a00" strokeWidth="0.6" strokeLinejoin="round" />
        </svg>
      );
    case 'folder':
      return (
        <svg width={16} height={16} viewBox="0 0 16 16" className="shrink-0">
          <path d="M1 3.5A1 1 0 0 1 2 2.5h4l1.5 1.6H14a1 1 0 0 1 1 1V13a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1Z" fill="#e0a526" />
          <path d={open ? 'M2.6 6.2h12.8L13.9 14H1.6Z' : 'M1 5.6h14V13a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1Z'} fill="#f8cb4f" />
        </svg>
      );
    case 'custom':
      return (
        <svg width={16} height={16} viewBox="0 0 16 16" className="shrink-0">
          <path d="M1.5 2h13l-5 6v5.5l-3 1.5V8Z" fill="#4ba3f5" stroke="#0b63c9" strokeWidth="0.8" strokeLinejoin="round" />
        </svg>
      );
    case 'log':
      return (
        <svg width={16} height={16} viewBox="0 0 16 16" className="shrink-0">
          <rect x="2.5" y="1.5" width="11" height="13" rx="1" fill="#f4f6f9" stroke="#7d8da3" strokeWidth="0.8" />
          <path d="M4.5 4.5h7M4.5 7h7M4.5 9.5h7M4.5 12h4" stroke="#4b8fd9" strokeWidth="1.1" />
        </svg>
      );
    case 'sub':
      return (
        <svg width={16} height={16} viewBox="0 0 16 16" className="shrink-0">
          <rect x="1.5" y="3" width="13" height="10" rx="1" fill="#f4f6f9" stroke="#7d8da3" strokeWidth="0.8" />
          <path d="M1.8 3.4 8 8.5l6.2-5.1" fill="none" stroke="#4b8fd9" strokeWidth="1.1" />
        </svg>
      );
  }
}
