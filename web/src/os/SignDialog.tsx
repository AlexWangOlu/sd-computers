import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { Eraser, Keyboard, PenLine, X } from 'lucide-react';
import { fetchNui, isEnvBrowser } from '@/nui/bridge';
import { t } from '@/i18n';

// Signing a line of a printed page (src/os/Paper.tsx). A character has one signature: it is drawn
// with the mouse, or typed and set in a hand, once - the server keeps it, and every page after is
// signed with it until it is changed here. Only the ink is the player's: whose name and what time
// go under it is the server's to say (server/computers/printing.lua).
//
// The ink is a small PNG with nothing behind it, cut down to the strokes themselves, so it sits on
// a line of any width.

/** The pad, in its own pixels (drawn at half that on the screen, so the strokes stay sharp). */
const PAD_W = 1040;
const PAD_H = 340;
const INK = '#16245c';
/** Longest signature the server keeps, in characters of its address (a little under its own limit). */
const MAX_CHARS = 56000;
/** Shortest stroke that counts as having signed: a stray click is not a signature. */
const MIN_INK = 60;

/** The hands a typed signature can be set in. Every one is a font Windows carries. */
const HANDS = [
  { id: 'script', font: "'Segoe Script', 'Lucida Handwriting', cursive", weight: 400, italic: false },
  { id: 'flowing', font: "'Lucida Handwriting', 'Segoe Script', cursive", weight: 400, italic: false },
  { id: 'pen', font: "'Ink Free', 'Segoe Print', cursive", weight: 400, italic: false },
  { id: 'formal', font: "Georgia, 'Times New Roman', serif", weight: 600, italic: true },
] as const;
type Hand = (typeof HANDS)[number];

const cssFont = (h: Hand, px: number): string => `${h.italic ? 'italic ' : ''}${h.weight} ${px}px ${h.font}`;

/** The ink on a canvas with the empty room round it cut away, as a PNG small enough to keep. */
function inkPng(canvas: HTMLCanvasElement): string | null {
  const c = canvas.getContext('2d');
  if (!c) return null;
  const { width, height } = canvas;
  const px = c.getImageData(0, 0, width, height).data;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (px[(y * width + x) * 4 + 3] <= 16) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0 || (x1 - x0 < 16 && y1 - y0 < 16)) return null;
  const pad = 8;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(width - 1, x1 + pad);
  y1 = Math.min(height - 1, y1 + pad);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  // It is kept no wider than a line is ever drawn (every page it goes on carries it to whoever
  // reads that page), and a heavy scribble is drawn smaller still until it is small enough to keep.
  for (let scale = Math.min(1, 480 / w); scale > 0.2; scale *= 0.75) {
    const out = document.createElement('canvas');
    out.width = Math.max(8, Math.round(w * scale));
    out.height = Math.max(8, Math.round(h * scale));
    const o = out.getContext('2d');
    if (!o) return null;
    o.drawImage(canvas, x0, y0, w, h, 0, 0, out.width, out.height);
    const url = out.toDataURL('image/png');
    if (url.length <= MAX_CHARS) return url;
  }
  return null;
}

/** A typed name set in a hand, as the same PNG a drawn signature is. */
async function typedPng(text: string, hand: Hand): Promise<string | null> {
  const clean = text.trim();
  if (clean.length < 2) return null;
  try {
    await document.fonts.load(cssFont(hand, 120), clean);
  } catch {
    // a font of the machine's own: there is nothing to wait for
  }
  const canvas = document.createElement('canvas');
  canvas.width = PAD_W;
  canvas.height = PAD_H;
  const c = canvas.getContext('2d');
  if (!c) return null;
  let size = 150;
  c.font = cssFont(hand, size);
  const wide = c.measureText(clean).width;
  if (wide > PAD_W - 80) size = Math.max(40, Math.floor((size * (PAD_W - 80)) / wide));
  c.font = cssFont(hand, size);
  c.fillStyle = INK;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(clean, PAD_W / 2, PAD_H / 2);
  return inkPng(canvas);
}

/** The signature kept for whoever is at the browser preview (the game asks the server). */
let previewSaved: string | null = null;

export function SignDialog({
  name,
  onClose,
  onSign,
}: {
  /** who they sign as: the character's name, as the server has it */
  name: string;
  onClose: () => void;
  /** sign with this ink (none = the signature they already have); answers what went wrong, or null */
  onSign: (image?: string) => Promise<string | null>;
}) {
  /** undefined while it is being asked for; null when they have never drawn one */
  const [saved, setSaved] = useState<string | null | undefined>(undefined);
  const [mode, setMode] = useState<'saved' | 'draw' | 'type'>('draw');
  const [typed, setTyped] = useState(name);
  const [hand, setHand] = useState<Hand>(HANDS[0]);
  const [inked, setInked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pad = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const length = useRef(0);

  useEffect(() => {
    let live = true;
    const got = (image: string | null) => {
      if (!live) return;
      setSaved(image);
      setMode(image ? 'saved' : 'draw');
    };
    if (isEnvBrowser()) got(previewSaved);
    else void fetchNui<{ ok?: boolean; image?: string | null }>('computers:paper:signature').then(r => got(r?.ok && typeof r.image === 'string' ? r.image : null));
    return () => {
      live = false;
    };
  }, []);

  /** Where on the pad a pointer is, in the pad's own pixels (the page it is on may be scaled). */
  const at = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / (rect.width || 1)) * canvas.width, y: ((e.clientY - rect.top) / (rect.height || 1)) * canvas.height };
  };

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // the stroke still draws while the pointer stays over the pad
    }
    drawing.current = true;
    last.current = at(e);
  };
  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const c = e.currentTarget.getContext('2d');
    if (!c) return;
    const p = at(e);
    const from = last.current;
    c.strokeStyle = INK;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    // (a quick stroke runs thin and a slow one sits heavy, the way a pen does)
    const step = Math.hypot(p.x - from.x, p.y - from.y);
    c.lineWidth = Math.max(3.2, 6.4 - step * 0.07);
    c.beginPath();
    c.moveTo(from.x, from.y);
    c.lineTo(p.x, p.y);
    c.stroke();
    last.current = p;
    length.current += step;
    if (!inked && length.current >= MIN_INK) setInked(true);
  };
  const up = () => {
    drawing.current = false;
  };
  const clear = () => {
    const canvas = pad.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    length.current = 0;
    setInked(false);
    setError(null);
  };

  const ready = mode === 'saved' ? !!saved : mode === 'draw' ? inked : typed.trim().length >= 2;

  const sign = useCallback(async () => {
    if (busy || !ready) return;
    setBusy(true);
    setError(null);
    let image: string | undefined;
    if (mode !== 'saved') {
      const made = mode === 'draw' ? (pad.current ? inkPng(pad.current) : null) : await typedPng(typed, hand);
      if (!made) {
        setBusy(false);
        setError(t('ui.print.sign_empty'));
        return;
      }
      image = made;
    }
    const problem = await onSign(image);
    if (problem) {
      setBusy(false);
      setError(problem);
      return;
    }
    if (image && isEnvBrowser()) previewSaved = image;
    onClose();
  }, [busy, ready, mode, typed, hand, onSign, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'Enter') void sign();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, sign]);

  return (
    <div className="sign-veil" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="sign-card" role="dialog" aria-label={t('ui.print.sign_title', name)}>
        <header className="sign-head">
          <PenLine size={16} />
          <span>{t('ui.print.sign_title', name)}</span>
          <button type="button" aria-label={t('ui.common.cancel')} title={t('ui.common.cancel')} onClick={onClose}>
            <X size={16} />
          </button>
        </header>

        {saved === undefined ? (
          <div className="sign-sheet is-waiting" />
        ) : mode === 'saved' && saved ? (
          <>
            <div className="sign-sheet">
              <img src={saved} alt="" draggable={false} />
              <i />
            </div>
            <p className="sign-note">{t('ui.print.sign_saved')}</p>
          </>
        ) : (
          <>
            <div className="sign-tabs">
              <button type="button" aria-pressed={mode === 'draw'} onClick={() => setMode('draw')}>
                <PenLine size={14} />
                {t('ui.print.sign_draw')}
              </button>
              <button type="button" aria-pressed={mode === 'type'} onClick={() => setMode('type')}>
                <Keyboard size={14} />
                {t('ui.print.sign_type')}
              </button>
            </div>
            {/* (the pad stays on the page while typing, so what was drawn is still there on the way back) */}
            <div className="sign-sheet" hidden={mode !== 'draw'}>
              <canvas ref={pad} width={PAD_W} height={PAD_H} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
              {!inked && <span className="sign-here">{t('ui.print.sign_draw_hint')}</span>}
              <i />
              {inked && (
                <button type="button" className="sign-clear" aria-label={t('ui.print.sign_clear')} title={t('ui.print.sign_clear')} onClick={clear}>
                  <Eraser size={14} />
                </button>
              )}
            </div>
            {mode === 'type' && (
              <>
                <input className="sign-input" value={typed} maxLength={40} autoFocus spellCheck={false} placeholder={t('ui.print.sign_type_placeholder')} aria-label={t('ui.print.sign_type_placeholder')} onChange={e => setTyped(e.target.value)} />
                <div className="sign-hands">
                  {HANDS.map(h => (
                    <button key={h.id} type="button" aria-pressed={hand.id === h.id} onClick={() => setHand(h)} style={{ font: cssFont(h, 22) }}>
                      {typed.trim() || name}
                    </button>
                  ))}
                </div>
              </>
            )}
            <p className="sign-note">{t('ui.print.sign_kept')}</p>
          </>
        )}

        {error && <p className="sign-error">{error}</p>}

        <footer className="sign-foot">
          {mode === 'saved' && (
            <button type="button" className="sign-btn" onClick={() => setMode('draw')}>
              {t('ui.print.sign_change')}
            </button>
          )}
          {mode !== 'saved' && saved && (
            <button
              type="button"
              className="sign-btn"
              onClick={() => {
                clear();
                setMode('saved');
              }}
            >
              {t('ui.print.sign_keep')}
            </button>
          )}
          <span />
          <button type="button" className="sign-btn" onClick={onClose}>
            {t('ui.common.cancel')}
          </button>
          <button type="button" className="sign-btn is-primary" disabled={!ready || busy} onClick={() => void sign()}>
            {t('ui.print.sign_confirm')}
          </button>
        </footer>
      </div>
    </div>
  );
}
