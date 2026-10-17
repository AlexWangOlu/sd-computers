import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Cog, Folder, Globe, LayoutGrid, Search } from 'lucide-react';
import type { WinApp } from '@/store/os';
import { useMacOS } from './compat';
import { HarborAppIcon } from './icons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// The reference Spotlight, searching sd-computers' apps. The reference also indexed its own VFS
// files and system settings; this resource's files live on the server, so the search covers the
// apps and the four shortcuts keep their behaviour.
export default function HarborSpotlight({ isOpen, onClose }: Props) {
  const { apps, openApp, t } = useMacOS();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return apps
      .filter(a => `${a.name} ${a.id}`.toLowerCase().includes(q))
      .slice(0, 8)
      .map(a => ({ id: a.id, name: a.name }));
  }, [apps, query]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setActiveIdx(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  const launch = (id: WinApp) => {
    openApp(id);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(i => Math.min(results.length - 1, i + 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(i => Math.max(0, i - 1));
      }
      if (e.key === 'Enter' && results[activeIdx]) {
        e.preventDefault();
        launch(results[activeIdx].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, results, activeIdx, onClose]);

  const shortcuts: { id: WinApp; icon: React.ReactNode; label: string }[] = [
    ...(apps.some(a => a.id === 'settings') ? [{ id: 'settings' as WinApp, icon: <Cog className="w-5 h-5" />, label: t.common.settings }] : []),
    ...(apps.some(a => a.id === 'files') ? [{ id: 'files' as WinApp, icon: <Folder className="w-5 h-5" />, label: t.system.files }] : []),
    ...(apps.some(a => a.id === 'browser') ? [{ id: 'browser' as WinApp, icon: <Globe className="w-5 h-5" />, label: t.system.web }] : []),
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="spotlight-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-[18vh]"
          style={{
            background: 'rgba(0,0,0,0.18)',
            backdropFilter: 'blur(18px) saturate(140%)',
            WebkitBackdropFilter: 'blur(18px) saturate(140%)',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-2xl mx-4"
          >
            <div
              className="rounded-[28px] overflow-hidden"
              style={{
                background: 'rgba(28,28,32,0.55)',
                backdropFilter: 'blur(40px) saturate(180%)',
                WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                border: '1px solid rgba(255,255,255,0.14)',
                boxShadow: '0 30px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-center gap-3 px-5 h-[60px]">
                <Search className="w-5 h-5 text-white/70 shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={t.system.spotlightSearch}
                  className="flex-1 bg-transparent outline-none text-white text-lg placeholder-white/40"
                />
              </div>

              {!query && (
                <div className="border-t border-white/10 px-3 py-3 flex items-center gap-2">
                  <button
                    onClick={() => {
                      openApp('launchpad');
                      onClose();
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/12 text-white/85 text-sm transition-colors"
                  >
                    <LayoutGrid className="w-5 h-5" />
                    <span>{t.system.apps}</span>
                  </button>
                  {shortcuts.map(s => (
                    <button
                      key={s.id}
                      onClick={() => launch(s.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/12 text-white/85 text-sm transition-colors"
                    >
                      {s.icon}
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {query && results.length > 0 && (
                <div className="border-t border-white/10 max-h-[55vh] overflow-y-auto py-2 px-2">
                  {results.map((r, i) => (
                    <button
                      key={r.id}
                      onMouseEnter={() => setActiveIdx(i)}
                      onClick={() => launch(r.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${
                        i === activeIdx ? 'bg-white/12 text-white' : 'text-white/85 hover:bg-white/6'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/10 shrink-0 flex items-center justify-center">
                        <HarborAppIcon app={r.id} size={34} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{r.name}</div>
                        <div className={`text-xs truncate ${i === activeIdx ? 'text-white/75' : 'text-white/50'}`}>{t.system.application}</div>
                      </div>
                      <ArrowRight className={`w-4 h-4 ${i === activeIdx ? 'opacity-100' : 'opacity-0'}`} />
                    </button>
                  ))}
                </div>
              )}

              {query && results.length === 0 && (
                <div className="border-t border-white/10 px-5 py-6 text-white/50 text-sm">{t.system.noResults(query)}</div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
