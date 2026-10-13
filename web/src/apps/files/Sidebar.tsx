import { FileText, Smartphone } from 'lucide-react';
import { t } from '@/i18n';
import { NavItem, Spinner } from '@/ui/controls';
import { setPlace, useFiles } from './store';
import { cx, fmtCount } from './model';

/** Left pane: the places documents live in, how many each holds, and how full Documents is. */
export default function Sidebar({ narrow }: { narrow: boolean }) {
  const place = useFiles(s => s.place);
  const count = useFiles(s => s.files.length);
  const max = useFiles(s => s.limits.maxFiles);
  const phone = useFiles(s => s.phone);
  const phoneStatus = useFiles(s => s.phoneStatus);
  const phoneCount = useFiles(s => s.phoneFiles.length);

  return (
    <aside className={cx('shrink-0 min-h-0 flex flex-col bg-win', narrow ? 'w-[190px]' : 'w-[220px]')}>
      <div className="px-4 pt-4 pb-2 text-caption font-semibold text-t2 truncate">{t('ui.files.places')}</div>
      <nav className="px-2 flex flex-col gap-0.5">
        <NavItem icon={<FileText size={16} />} label={t('ui.files.documents')} selected={place === 'documents'} onClick={() => setPlace('documents')} badge={<Count n={count} />} />
        {phone && (
          <NavItem
            icon={<Smartphone size={16} />}
            label={t('ui.files.phone')}
            selected={place === 'phone'}
            onClick={() => setPlace('phone')}
            badge={phoneStatus === 'ready' ? <Count n={phoneCount} /> : phoneStatus === 'loading' ? <Spinner size={12} /> : undefined}
          />
        )}
      </nav>
      <div className="mt-auto px-4 py-3 text-caption text-t3 truncate">{t('ui.files.usage', fmtCount(count), fmtCount(max))}</div>
    </aside>
  );
}

/** How many documents a place holds. Plain text: the accent badge would read as "unread". */
function Count({ n }: { n: number }) {
  return <span className="shrink-0 text-caption text-t2 tabular-nums">{fmtCount(n)}</span>;
}
