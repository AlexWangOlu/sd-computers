import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Airplay, Music2, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { HiSun } from 'react-icons/hi';
import { CgDarkMode } from 'react-icons/cg';
import { IoVolumeMedium, IoBluetooth } from 'react-icons/io5';
import { IoIosWifi } from 'react-icons/io';
import { useMacOS } from './compat';
import { playToggleSound, playVolumeChange } from './sounds';

const AirdropSvg = ({ className = '' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" className={className} fill="none">
    <path fill="currentColor" d="M8 2.6666666666666665a5.333333333333333 5.333333333333333 0 0 0 -2.385333333333333 10.104666666666667 0.6666666666666666 0.6666666666666666 0 0 1 -0.5973333333333333 1.1926666666666665A6.666666666666666 6.666666666666666 0 0 1 1.3333333333333333 8C1.3333333333333333 4.318 4.318 1.3333333333333333 8 1.3333333333333333s6.666666666666666 2.9846666666666666 6.666666666666666 6.666666666666666a6.666666666666666 6.666666666666666 0 0 1 -3.6839999999999997 5.9639999999999995 0.6666666666666666 0.6666666666666666 0 1 1 -0.5973333333333333 -1.1926666666666665A5.333333333333333 5.333333333333333 0 0 0 8 2.6666666666666665Zm0 2.6666666666666665a2.6666666666666665 2.6666666666666665 0 0 0 -1.1926666666666665 5.052666666666666 0.6666666666666666 0.6666666666666666 0 0 1 -0.5966666666666667 1.192 4 4 0 1 1 3.579333333333333 0 0.6666666666666666 0.6666666666666666 0 0 1 -0.5973333333333333 -1.192A2.6666666666666665 2.6666666666666665 0 0 0 8 5.333333333333333Zm-1.3333333333333333 2.6666666666666665a1.3333333333333333 1.3333333333333333 0 1 1 2.6666666666666665 0 1.3333333333333333 1.3333333333333333 0 0 1 -2.6666666666666665 0Z"/>
  </svg>
);

interface Props { open: boolean; onClose: () => void; }

interface MediaState {
  appId: string;
  app?: string;
  title?: string;
  artist?: string;
  cover?: string;
  playing?: boolean;
  progress?: number;
  duration?: number;
}

export const ControlCenter = ({ open, onClose }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const { settings, updateSettings, t } = useMacOS();
  const [airplayOn, setAirplayOn] = useState(false);
  const [soundAirplayOn, setSoundAirplayOn] = useState(false);
  const [media, setMedia] = useState<MediaState | null>(null);

  useEffect(() => {
    const onMediaState = (event: Event) => {
      setMedia((event as CustomEvent<MediaState>).detail);
    };
    window.addEventListener('computer:media-state', onMediaState);
    return () => window.removeEventListener('computer:media-state', onMediaState);
  }, []);

  const sendMediaCommand = (command: 'toggle' | 'next' | 'prev') => {
    if (!media?.appId) return;
    window.dispatchEvent(new CustomEvent('computer:media-command', {
      detail: { appId: media.appId, data: { command } },
    }));
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  const isDark = settings.theme === 'dark';
  const toggleSetting = (key: 'wifi' | 'bluetooth' | 'airdrop' | 'focus', current: boolean | undefined) => {
    const next = !current;
    updateSettings({ [key]: next });
    playToggleSound(next);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: -10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed top-9 right-3 z-[300] rounded-3xl p-3 text-white"
          style={{
            width: 360,
            background: 'rgba(28,28,32,0.55)',
            backdropFilter: 'blur(40px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 20px 60px -10px rgba(0,0,0,0.5)',
          }}
        >
          <div className="grid grid-cols-2 gap-2 mb-2">
            {/* LEFT: connectivity stack */}
            <div className="rounded-2xl bg-white/10 p-2.5 flex flex-col gap-1.5">
              <ConnRow active={settings.wifi} onClick={() => toggleSetting('wifi', settings.wifi)}
                icon={<IoIosWifi className="w-[24px] h-[24px]" />} label="Wi-Fi" sub={settings.wifi ? t.controlCenter.network : t.common.off} />
              <ConnRow active={settings.bluetooth} onClick={() => toggleSetting('bluetooth', settings.bluetooth)}
                icon={<IoBluetooth className="w-[22px] h-[22px]" />} label={t.settings.bluetooth} sub={settings.bluetooth ? t.common.on : t.common.off} />
              <ConnRow active={settings.airdrop} onClick={() => toggleSetting('airdrop', settings.airdrop)}
                icon={<AirdropSvg className="w-[22px] h-[22px]" />}
                label="AirDrop" sub={t.controlCenter.contactsOnly} />
            </div>

            {/* RIGHT: focus on top, two squares on bottom */}
            <div className="grid grid-rows-[auto_auto] gap-2">
              <button
  onClick={() => toggleSetting('focus', settings.focus)}
  className="rounded-2xl bg-white/10 hover:bg-black/20 transition-colors px-3 py-2 flex items-center gap-3 text-left min-h-[78px]"
>
  <div
    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
      settings.focus ? 'bg-violet-500' : 'bg-white/15'
    }`}
  >
    <Moon className="w-4 h-4" />
  </div>

  <div className="leading-tight">
    <div className="text-[12.5px] font-semibold">{t.controlCenter.focus}</div>
    <div className="text-[10.5px] text-white/55">
      {settings.focus ? t.common.on : t.common.off}
    </div>
  </div>
</button>
              <div className="grid grid-cols-2 gap-2">
                <SquareTile
                  active={airplayOn}
                  onClick={() => setAirplayOn(value => { const next = !value; playToggleSound(next); return next; })}
                  icon={<Airplay className="w-5 h-5" />}
                  label={t.controlCenter.screen}
                  accent="bg-blue-500"
                />
                <SquareTile
                  active={!isDark}
                  onClick={() => { const nextIsLight = isDark; updateSettings({ theme: nextIsLight ? 'light' : 'dark' }); playToggleSound(nextIsLight); }}
                  icon={<CgDarkMode className="w-4 h-4" />}
                  label={isDark ? t.controlCenter.light : t.controlCenter.dark}
                  accent="bg-amber-500"
                />
              </div>
            </div>
          </div>

          <SliderModule
  label={t.controlCenter.display}
  value={settings.brightness ?? 80}
  onChange={(v) => updateSettings({ brightness: v })}
  icon={<HiSun className="w-[15px] h-[15px] text-neutral-700 opacity-50" />}
/>

<SliderModule
  label={t.controlCenter.sound}
  value={settings.volume ?? 65}
  onChange={(v) => updateSettings({ volume: v })}
  soundFeedback
  icon={<IoVolumeMedium className="w-[16px] h-[16px] text-neutral-700 opacity-50" />}
  trailing={
    <button
      onClick={() => setSoundAirplayOn(value => { const next = !value; playToggleSound(next); return next; })}
      className="ml-2 w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors"
      style={{
        background: soundAirplayOn ? '#3b82f6' : 'rgba(255,255,255,0.15)',
        color: soundAirplayOn ? '#fff' : '#fff',
      }}
    >
      <Airplay className="w-4 h-4" />
    </button>
  }
/>
          <div className="rounded-2xl bg-white/10 p-3 mt-2 flex items-center gap-3">
            {media?.app ? (
              <>
                {media.cover ? (
                  <img src={media.cover} alt="" className="h-11 w-11 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 text-white/55">
                    <Music2 className="h-5 w-5" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold truncate">{media.title || 'MineRadio'}</div>
                  <div className="text-[11px] text-white/55 truncate">{media.artist || '音乐播放器已连接'}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => sendMediaCommand('prev')}
                    className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                    aria-label="上一首"
                  >
                    <SkipBack className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => sendMediaCommand('toggle')}
                    className="grid h-8 w-8 place-items-center rounded-full bg-white text-black hover:bg-white/90"
                    aria-label="播放/暂停"
                  >
                    {media.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => sendMediaCommand('next')}
                    className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                    aria-label="下一首"
                  >
                    <SkipForward className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 text-white/55">
                  <Music2 className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold truncate">{t.controlCenter.notPlaying}</div>
                  <div className="text-[11px] text-white/55 truncate">{t.controlCenter.noMedia}</div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const ConnRow = ({ active, onClick, icon, label, sub }: { active?: boolean; onClick: () => void; icon: React.ReactNode; label: string; sub: string }) => (
  <button onClick={onClick} className="flex items-center gap-2.5 px-1.5 py-1 rounded-xl transition-colors text-left hover:bg-black/25">
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white ${active ? 'bg-blue-500' : 'bg-white/15'}`}>{icon}</div>
    <div className="leading-tight min-w-0">
      <div className="text-[12.5px] font-semibold truncate">{label}</div>
      <div className="text-[10.5px] text-white/55 truncate">{sub}</div>
    </div>
  </button>
);

const SquareTile = ({
  active,
  onClick,
  icon,
  label,
  accent
}: {
  active?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  accent: string;
}) => (
  <button
    onClick={onClick}
    className="rounded-2xl bg-white/10 hover:bg-black/25 transition-colors p-2.5 flex flex-col items-center justify-center aspect-square min-h-[68px]"
  >
    <div
      className={`w-8 h-8 rounded-full flex items-center justify-center ${
        active ? accent : 'bg-white/15'
      }`}
    >
  {icon}
</div>

<div className="text-[11px] font-semibold mt-1 text-center">
  {label}
</div>
  </button>
);

// macOS-style pill slider with embedded icon and white "filled" indicator.
const SliderModule = ({
  label,
  value,
  onChange,
  icon,
  trailing,
  soundFeedback = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  icon: React.ReactNode;
  trailing?: React.ReactNode;
  soundFeedback?: boolean;
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

  const updateFromX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = clamp((clientX - r.left) / r.width, 0, 1);
    const nextValue = Math.round(p * 100);
    onChange(nextValue);
    if (soundFeedback) playVolumeChange(nextValue);
  }, [onChange, soundFeedback]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => updateFromX(e.clientX);
    const onUp = () => setDragging(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, updateFromX]);

  const pct = clamp(value, 0, 100);

  return (
    <div className="rounded-2xl bg-white/10 px-3 pt-3 pb-3 mt-2">
      <div className="text-[12.5px] font-semibold mb-2">{label}</div>

      <div className="flex items-center gap-2 min-h-[36px]">
  <div
    ref={trackRef}
    onPointerDown={(e) => {
      (e.target as Element).setPointerCapture?.(e.pointerId);
      setDragging(true);
      updateFromX(e.clientX);
    }}
    className="relative flex-1 h-7 rounded-full cursor-pointer select-none"
    style={{ background: 'rgba(255,255,255,0.18)' }}
  >
    {/* filled track */}
    <div
      className="absolute top-0 bottom-0 left-0 rounded-full"
      style={{
        width: `calc(${pct}% + 11px)`,
        maxWidth: '100%',
        background: '#ffffff',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.05)',
      }}
    />

    {/* icon pinned inside the filled portion */}
    <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
      {icon}
    </div>
  </div>

  {trailing}
</div>
    </div>
  );
};
