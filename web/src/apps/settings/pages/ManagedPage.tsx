import { t } from '@/i18n';
import { InfoBar, Toggle } from '@/ui/controls';
import { Group, PageHeader, Row } from '../ui';
import type { Go } from '../nav';

type Managed = 'themes' | 'lockscreen' | 'start' | 'taskbar';

/** Each sub-page's rows: an i18n key under ui.settings and the (locked) toggle state, if any. */
const ROWS: Record<Managed, { key: string; on?: boolean }[]> = {
  themes: [{ key: 'themes_current' }, { key: 'themes_icons' }, { key: 'themes_contrast' }],
  lockscreen: [{ key: 'lock_status' }, { key: 'lock_signin', on: true }, { key: 'lock_timeout' }],
  start: [{ key: 'start_recent', on: true }, { key: 'start_recommended', on: false }, { key: 'start_account', on: false }],
  taskbar: [{ key: 'taskbar_taskview', on: true }, { key: 'taskbar_widgets', on: false }, { key: 'taskbar_autohide', on: false }],
};

/**
 * Personalization's cosmetic sub-pages (Themes, Lock screen, Start, Taskbar). This is a work
 * computer, so - like a domain-joined PC - they're shown but locked by the organization.
 */
export default function ManagedPage({ page, go }: { page: Managed; go: Go }) {
  return (
    <>
      <PageHeader parent={t('ui.settings.nav_personalization')} onParent={() => go('personalization')} title={t(`ui.settings.${page}`)} />
      <div className="mb-6">
        <InfoBar severity="info">{t('ui.settings.managed')}</InfoBar>
      </div>
      <Group>
        {ROWS[page].map(r => (
          <Row key={r.key} title={t(`ui.settings.${r.key}`)} description={t(`ui.settings.${r.key}_desc`)}>
            {r.on !== undefined && <Toggle checked={r.on} disabled onChange={() => undefined} label={r.on ? t('ui.settings.on') : t('ui.settings.off')} />}
          </Row>
        ))}
      </Group>
    </>
  );
}

export type { Managed };
