import { useEffect, useMemo, useState } from 'react';
import { MonitorUp } from 'lucide-react';
import { useAdmin } from '@/admin/store/admin';
import { t, tOr } from '@/admin/i18n';
import { Badge, Field, Heading } from '@/admin/components/shared';
import { ComputerSetupModal } from '../computers/ComputerSetupModal';
import { StylePreview } from '../computers/StylePreview';

// The catalogue: every look a computer can open in (configs/shared/desktop.lua > Styles), shown as
// it greets whoever sits down, with what it is and how many computers use it. Click through the
// list (or use the arrow keys) and the screen swaps in place.
export const StylesTab = () => {
  const snapshot = useAdmin(s => s.snapshot)!;
  const focus = useAdmin(s => s.styleFocus);
  const busy = useAdmin(s => s.busy);
  const styles = snapshot.styles;
  const [key, setKey] = useState(focus ?? styles[0]?.key ?? '');
  const [placing, setPlacing] = useState(false);

  // How many computers open in each.
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    snapshot.computers.forEach(c => {
      out[c.style] = (out[c.style] ?? 0) + 1;
    });
    return out;
  }, [snapshot.computers]);

  useEffect(() => {
    if (focus) {
      setKey(focus);
      useAdmin.getState().focusStyle(null);
    }
  }, [focus]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[data-modal]')) return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const i = styles.findIndex(s => s.key === key);
      const next = styles[(i + (e.key === 'ArrowDown' ? 1 : -1) + styles.length) % styles.length];
      if (next) setKey(next.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key, styles]);

  const style = styles.find(s => s.key === key);

  return (
    <div className="flex flex-col h-full min-h-0 px-6 py-5 gap-4">
      <Heading title={t('tabs.styles')} count={styles.length}>
        {snapshot.canEdit && style && (
          <button type="button" className="sc-btn sc-btn--primary" disabled={busy || snapshot.props.length === 0} onClick={() => setPlacing(true)}>
            <MonitorUp size={14} />
            {t('styles.place_this')}
          </button>
        )}
      </Heading>

      <div className="flex-1 min-h-0 flex gap-4">
        <div className="min-h-0 flex-shrink-0" style={{ width: 300 }}>
          <div className="sc-list">
            {styles.map(s => (
              <button key={s.key} type="button" className={`sc-row sc-row--click w-full text-left${key === s.key ? ' sc-row--active' : ''}`} aria-pressed={key === s.key} onClick={() => setKey(s.key)}>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] font-medium truncate">{s.name}</span>
                    {s.default && <Badge>{t('styles.default')}</Badge>}
                  </span>
                  <span className="block text-[11.5px] mono mt-0.5 truncate" style={{ color: 'var(--text-3)' }}>
                    {s.key} · {s.build}
                  </span>
                </span>
                <span className="mono text-[12px] flex-shrink-0" style={{ color: 'var(--text-3)' }}>
                  {counts[s.key] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-3">
          <div className="flex-1 min-h-0 flex items-center justify-center">
            {style && (
              // (as wide as the height it has allows: the screen keeps its 16:10)
              <div className="h-full max-w-full" style={{ aspectRatio: '16 / 10' }}>
                <StylePreview key={style.key} style={style} className="animate-fadeIn" />
              </div>
            )}
          </div>
          {style && (
            <div className="sc-card px-5 py-3 flex-shrink-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-[14px] font-semibold">{style.name}</span>
                {style.default && <Badge>{t('styles.default')}</Badge>}
                <span className="ml-auto mono text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                  {style.key} · {t('styles.computers_using', String(counts[style.key] ?? 0))}
                </span>
              </div>
              <p className="text-[12.5px] leading-relaxed m-0 mb-1" style={{ color: 'var(--text-2)' }}>
                {tOr(`styles.about.${style.key}`, t('styles.about.other'))}
              </p>
              <div className="grid grid-cols-3 gap-x-8">
                <Field label={t('styles.build')}>{style.build}</Field>
                <Field label={t('styles.theme')}>{t(`styles.theme_${style.theme}`)}</Field>
                <Field label={t('styles.wallpapers')}>{style.wallpapers.length}</Field>
                <div className="col-span-3">
                  <Field label={t('styles.wallpaper_list')}>
                    <span title={style.wallpapers.join(', ')}>{style.wallpapers.join(', ')}</span>
                  </Field>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {placing && style && <ComputerSetupModal initialStyle={style.key} onClose={() => setPlacing(false)} />}
    </div>
  );
};
