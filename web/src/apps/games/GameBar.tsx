import type { ReactNode } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { t } from '@/i18n';
import { Button, IconButton } from '@/ui/controls';
import { still } from './shared';

/**
 * The strip above every game: back to the launcher, the game's name, its counters and controls
 * (the children), and New game. `narrow` drops the Back label so a small window still fits it all.
 */
export function GameBar({ title, narrow, onBack, onNew, children }: { title: string; narrow: boolean; onBack: () => void; onNew: () => void; children?: ReactNode }) {
  return (
    <div className="shrink-0 h-11 flex items-center gap-2 px-2 border-b border-stroke overflow-hidden">
      {narrow ? (
        <IconButton title={t('ui.games.back')} onClick={onBack} {...still}>
          <ArrowLeft size={16} />
        </IconButton>
      ) : (
        <Button variant="subtle" compact icon={<ArrowLeft size={16} />} onClick={onBack} {...still}>
          {t('ui.games.back')}
        </Button>
      )}
      <span className="min-w-0 truncate text-body font-semibold text-t1">{title}</span>
      <span className="flex-1" />
      {children}
      <Button compact icon={<RotateCcw size={16} />} onClick={onNew} {...still}>
        {t('ui.games.new_game')}
      </Button>
    </div>
  );
}

/** One counter in the bar: an icon and a number that keeps its width as it changes. */
export function Counter({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <span
      title={label}
      aria-label={label}
      className="shrink-0 inline-flex items-center justify-center gap-1.5 h-7 min-w-[60px] px-2 rounded-ctl bg-card border border-stroke text-body text-t1 tabular-nums"
    >
      <span className="flex text-t2">{icon}</span>
      {value}
    </span>
  );
}
