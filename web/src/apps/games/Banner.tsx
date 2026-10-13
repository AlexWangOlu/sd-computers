import type { ReactNode } from 'react';
import { useExitFx } from '@/hooks/useExitFx';
import { InfoBar } from '@/ui/controls';

/**
 * How a game ended, said calmly over the foot of the board. It can be closed to see what is under
 * it, and fades out when it goes. The parent needs `relative`.
 */
export function Banner({ tone, title, children, onClose }: { tone: 'success' | 'error'; title: ReactNode; children?: ReactNode; onClose: () => void }) {
  const exit = useExitFx('fade-out');
  return (
    // Centred with flex, not a translate: the info bar's own entrance animates its transform.
    <div ref={exit} className="absolute inset-x-0 bottom-4 z-[2000] flex justify-center px-4 pointer-events-none">
      {/* The info bar's tint is see-through: it needs something solid behind it over a board. */}
      <div className="pointer-events-auto max-w-full rounded-win bg-layer shadow-flyout">
        <InfoBar severity={tone} title={title} onClose={onClose}>
          {children}
        </InfoBar>
      </div>
    </div>
  );
}
