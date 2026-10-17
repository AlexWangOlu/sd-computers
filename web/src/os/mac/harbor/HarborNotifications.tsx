import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMacOS } from './compat';
import { formatSystemDate, formatSystemTime } from './i18n';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const NotificationCenter = ({ open, onClose }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const time = new Date();
  const { language, t } = useMacOS();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className="fixed top-9 right-3 z-[300] rounded-2xl p-4 text-white"
          style={{
            width: 340,
            maxHeight: '85vh',
            overflowY: 'auto',
            background: 'rgba(28,28,32,0.6)',
            backdropFilter: 'blur(40px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 20px 60px -10px rgba(0,0,0,0.5)',
          }}
        >
          <div className="text-center mb-4">
            <div className="text-[12px] text-white/70">{formatSystemDate(time, language, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            <div className="text-[44px] font-light leading-none mt-1">
              {formatSystemTime(time, language, { hour12: false })}
            </div>
          </div>

          <div className="rounded-xl px-4 py-5 text-center" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="text-[13px] font-semibold">{t.system.noNewNotifications}</div>
            <div className="mt-1 text-[11.5px] text-white/55">{t.system.notificationEmpty}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
