import { Unplug } from 'lucide-react';
import { t } from '@/i18n';
import { Button } from '@/ui/controls';
import type { Network } from './types';
import { HOME, similarSites } from './model';
import { Column, SiteCard, type OpenFn } from './parts';

/**
 * Any address the network does not have - a typo, a dead link, a real URL from outside. Nothing
 * was requested to find that out: the address simply is not in the list.
 */
export default function NotFound({ address, net, onOpen }: { address: string; net: Network; onOpen: OpenFn }) {
  const similar = similarSites(net, address);
  return (
    <Column>
      <div className="pt-6 flex flex-col items-start">
        <span className="w-12 h-12 rounded-win flex items-center justify-center bg-card border border-stroke text-t2">
          <Unplug size={24} />
        </span>
        <h1 className="mt-5 text-title font-semibold text-t1">{t('ui.browser.missing_title')}</h1>
        <div className="mt-2 font-mono text-body text-t1 break-all select-text">{address}</div>
        <p className="mt-4 text-body leading-6 text-t2">{t('ui.browser.missing_body')}</p>
        <ul className="mt-2 pl-5 list-disc marker:text-t3 text-body leading-6 text-t2">
          <li>{t('ui.browser.missing_tip_spelling')}</li>
          <li>{t('ui.browser.missing_tip_network')}</li>
        </ul>
        <Button variant="accent" className="mt-6" onClick={() => onOpen(HOME)}>
          {t('ui.browser.missing_home')}
        </Button>
      </div>

      {similar.length > 0 && (
        <div className="mt-10">
          <div className="mb-2 text-caption font-semibold text-t2">{t('ui.browser.missing_similar')}</div>
          <div className="flex flex-col gap-2">
            {similar.map(s => (
              <SiteCard key={s.address} title={s.title} detail={s.address} onOpen={newTab => onOpen(s.address, newTab)} />
            ))}
          </div>
        </div>
      )}
    </Column>
  );
}
