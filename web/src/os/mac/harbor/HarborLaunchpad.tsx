import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { useMacOS } from './compat';
import { HarborAppIcon } from './icons';

// The reference Launchpad: the desktop blurred away, every app on a grid, a search field on top.
// It opens from the dock's first tile, the File menu and Spotlight.
export default function HarborLaunchpad({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { apps, openApp, t } = useMacOS();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const list = apps.filter(a => !query.trim() || a.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex flex-col items-center pt-[9vh] text-white"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.22 }}
          onClick={onClose}
          style={{
            background: 'rgba(0,0,0,0.42)',
            backdropFilter: 'blur(38px) saturate(150%)',
            WebkitBackdropFilter: 'blur(38px) saturate(150%)',
          }}
        >
          <div className="w-full max-w-[260px]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 rounded-xl bg-white/10 border border-white/15 px-3 h-9">
              <Search className="w-4 h-4 text-white/60" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t.system.searchApps}
                className="flex-1 bg-transparent outline-none text-[13px] placeholder-white/40"
              />
            </div>
          </div>

          <div
            className="mt-10 grid gap-x-10 gap-y-7 px-6 w-full max-w-[1040px]"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))' }}
            onClick={e => e.stopPropagation()}
          >
            {list.map(app => (
              <button
                key={app.id}
                onClick={() => {
                  openApp(app.id);
                  onClose();
                }}
                className="flex flex-col items-center gap-2 group"
              >
                <span
                  className="w-[76px] h-[76px] overflow-hidden rounded-[18px] shadow-xl transition-transform duration-150 group-hover:scale-105 group-active:scale-95"
                  style={{ boxShadow: '0 10px 26px rgba(0,0,0,0.42)' }}
                >
                  <HarborAppIcon app={app.id} size={76} />
                </span>
                <span className="text-[12px] text-center leading-tight drop-shadow">{app.name}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
