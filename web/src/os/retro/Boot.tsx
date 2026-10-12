// The power-on ritual, staged like the real thing (ported from frp_mdt's Boot):
//
//   off -> flash (CRT turn-on line + switch clunk / degauss / fan) -> post (SD-BIOS memory count,
//   typed SD-DOS commands, [ OK ] network lines) -> flip (the tube blanks for a beat) -> splash
//   (the SD mark zooms in chunky steps, loading blocks fill) -> onDone.
//
// The POST runs as one cancellable async script writing into a line buffer. Any real key or click
// skips forward (to the splash, then out); bare modifiers don't count - the interaction key that
// opened the computer may still be held.
import { useEffect, useRef, useState } from 'react';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { PixelMark } from './glyphs';
import { LoadBlocks } from './MessageBox';
import { retroSfx } from './sounds';

type LineKind = 'dim' | 'sys' | 'ok' | 'warn' | 'plain' | 'input';
interface Line {
  text: string;
  kind: LineKind;
}
type Stage = 'off' | 'flash' | 'post' | 'flip' | 'splash';

const LOAD_BLOCKS = 16;
const MODIFIERS = new Set(['Alt', 'Control', 'Shift', 'Meta', 'AltGraph']);

export default function BootScreen({ onDone }: { onDone: () => void }) {
  const payload = useOS(s => s.payload)!;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [stage, setStage] = useState<Stage>(reduced ? 'splash' : 'off');
  const [lines, setLines] = useState<Line[]>([]);
  const [blocks, setBlocks] = useState(reduced ? LOAD_BLOCKS : 0);
  const powered = useRef(false);
  const year = new Date().getFullYear();

  const powerOn = () => {
    if (powered.current) return;
    powered.current = true;
    retroSfx.powerOn();
  };

  // The line buffer lives in a ref so the script can append/patch without fighting batching.
  const buf = useRef<Line[]>([]);
  const commit = () => setLines([...buf.current]);
  const push = (text: string, kind: LineKind = 'plain') => {
    buf.current.push({ text, kind });
    commit();
    return buf.current.length - 1;
  };
  const patch = (i: number, text: string, kind?: LineKind) => {
    buf.current[i] = { text, kind: kind ?? buf.current[i].kind };
    commit();
  };

  // off -> flash -> post, and the flip's blank beat.
  useEffect(() => {
    if (stage === 'off') {
      const tm = window.setTimeout(() => setStage('flash'), 280);
      return () => window.clearTimeout(tm);
    }
    if (stage === 'flash') {
      powerOn();
      const tm = window.setTimeout(() => {
        retroSfx.beep();
        setStage('post');
      }, 520);
      return () => window.clearTimeout(tm);
    }
    if (stage === 'flip') {
      const tm = window.setTimeout(() => setStage('splash'), 150);
      return () => window.clearTimeout(tm);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // The POST script.
  useEffect(() => {
    if (stage !== 'post') return;
    let dead = false;
    const sleep = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms));
    const c = payload.computer;

    const typeLine = async (prompt: string, text: string) => {
      const i = push(prompt, 'input');
      for (let n = 1; n <= text.length; n++) {
        if (dead) return;
        patch(i, prompt + text.slice(0, n));
        retroSfx.key();
        await sleep(30);
      }
      retroSfx.key('enter');
      await sleep(110);
    };

    void (async () => {
      await sleep(180);
      if (dead) return;
      push(t('ui.retro.post_bios', year), 'sys');
      push(t('ui.retro.post_cpu'));
      await sleep(240);
      if (dead) return;

      const mem = push(t('ui.retro.post_mem', '0'));
      for (let kb = 256; kb <= 4096; kb += 256) {
        if (dead) return;
        patch(mem, t('ui.retro.post_mem', String(kb).padStart(4, ' ')));
        if ((kb / 256) % 2 === 0) retroSfx.tick();
        await sleep(24);
      }
      patch(mem, t('ui.retro.post_mem_ok', '4096'));
      await sleep(150);
      if (dead) return;

      retroSfx.hddSeek(340);
      push(t('ui.retro.post_disk'));
      push(t('ui.retro.post_ports'));
      await sleep(300);
      if (dead) return;

      push('', 'dim');
      push(t('ui.retro.post_starting'));
      await sleep(420);
      if (dead) return;
      push('', 'dim');

      await typeLine('C:\\>', t('ui.retro.post_cmd_cd'));
      if (dead) return;
      await typeLine(`C:\\${t('ui.retro.post_dir')}>`, t('ui.retro.post_cmd_net'));
      if (dead) return;
      retroSfx.hddSeek(300);
      await sleep(200);
      if (dead) return;

      push(t('ui.retro.post_net_title'), 'sys');
      push('------------------------------------------------------', 'dim');
      await sleep(160);
      if (dead) return;
      push(t('ui.retro.post_link', c.ip), 'ok');
      await sleep(170);
      if (dead) return;
      push(t('ui.retro.post_host', c.hostname.toUpperCase()), 'ok');
      await sleep(170);
      if (dead) return;
      push(t('ui.retro.post_station', c.label.toUpperCase()), 'ok');
      push('------------------------------------------------------', 'dim');
      await sleep(260);
      if (dead) return;

      await typeLine(`C:\\${t('ui.retro.post_dir')}>`, t('ui.retro.post_cmd_shell'));
      if (dead) return;
      retroSfx.hddSeek(420);
      await sleep(360);
      if (dead) return;
      setStage('flip');
    })();

    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Splash: the blocks fill, then hand over.
  useEffect(() => {
    if (stage !== 'splash') return;
    if (reduced) {
      const tm = window.setTimeout(onDone, 600);
      return () => window.clearTimeout(tm);
    }
    retroSfx.chime();
    const tick = window.setInterval(() => setBlocks(b => (b >= LOAD_BLOCKS ? b : b + 1)), 80);
    return () => window.clearInterval(tick);
  }, [stage, reduced, onDone]);

  useEffect(() => {
    if (stage !== 'splash' || reduced || blocks < LOAD_BLOCKS) return;
    const tm = window.setTimeout(onDone, 380);
    return () => window.clearTimeout(tm);
  }, [stage, blocks, reduced, onDone]);

  // Skip: anything before the splash jumps to it; the splash jumps out.
  useEffect(() => {
    const skip = (e: Event) => {
      if (e instanceof KeyboardEvent && (MODIFIERS.has(e.key) || e.key === 'Escape')) return;
      powerOn();
      if (stage === 'splash') onDone();
      else setStage('splash');
    };
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
    return () => {
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, onDone]);

  if (stage === 'off') return <div className="rt-boot" />;
  if (stage === 'flash')
    return (
      <div className="rt-boot">
        <div className="rt-crt-on" />
      </div>
    );
  if (stage === 'flip') return <div className="rt-boot" />;

  if (stage === 'splash') {
    return (
      <div className="rt-splash">
        <div className="rt-splash-logo">
          <PixelMark size={96} grid={24} />
        </div>
        <div className="rt-splash-title">{payload.desktop.osName}</div>
        <div className="rt-splash-sub">
          {t('ui.retro.splash_version', payload.desktop.osBuild)}&nbsp;&nbsp;·&nbsp;&nbsp;{t('ui.retro.splash_copy', year)}
        </div>
        <LoadBlocks count={LOAD_BLOCKS} filled={blocks} className="rt-splash-blocks" />
      </div>
    );
  }

  return (
    <div className="rt-boot rt-boot-glow">
      {/* Carries the turn-on glow over from the flash and breathes it out under the first lines. */}
      <div className="rt-crt-decay" />
      {lines.map((l, i) => (
        <div key={i} className={`rt-post-${l.kind}`}>
          {l.text || '\u00a0'}
        </div>
      ))}
      <span className="rt-boot-caret" />
      <div className="rt-boot-skip">{t('ui.retro.post_skip')}</div>
    </div>
  );
}
