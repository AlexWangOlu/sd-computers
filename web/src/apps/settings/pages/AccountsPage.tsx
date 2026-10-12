import { KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { Avatar } from '@/os/icons';
import { Expander, Group, PageHeader, Row, SubRow } from '../ui';

/** Accounts: who is signed in and how this computer is unlocked. */
export default function AccountsPage() {
  const user = useOS(s => s.payload!.user);
  const requiresPin = useOS(s => s.payload!.computer.requiresPin);

  return (
    <>
      <PageHeader title={t('ui.settings.nav_accounts')} />

      <div className="flex items-center gap-5 rounded-win border border-stroke bg-card px-5 py-5 mb-6 min-w-0">
        <Avatar initials={user.initials} size={88} />
        <div className="min-w-0">
          <div className="text-subtitle font-semibold text-t1 truncate">{user.name}</div>
          {user.job && <div className="text-body text-t2 truncate">{user.job}</div>}
          <div className="text-body text-t2">{t('ui.settings.local_account')}</div>
          <div className="text-caption text-t3 mt-1">{t('ui.settings.administrator')}</div>
        </div>
      </div>

      <Group title={t('ui.settings.account_settings')}>
        <Expander defaultOpen icon={<KeyRound size={20} strokeWidth={1.5} />} title={t('ui.settings.signin')} description={t('ui.settings.signin_desc')}>
          <SubRow
            label={t('ui.settings.pin')}
            description={requiresPin ? t('ui.settings.pin_required') : t('ui.settings.pin_none')}
          >
            <span className={`text-caption ${requiresPin ? 'text-success' : 'text-t3'}`}>
              {requiresPin ? t('ui.settings.pin_on') : t('ui.settings.pin_off')}
            </span>
          </SubRow>
          <SubRow label={t('ui.settings.password')} description={t('ui.settings.password_desc')} />
        </Expander>
        <Row icon={<Mail size={20} strokeWidth={1.5} />} title={t('ui.settings.email_accounts')} description={t('ui.settings.email_accounts_desc')} />
        <Row icon={<ShieldCheck size={20} strokeWidth={1.5} />} title={t('ui.settings.access_work')} description={t('ui.settings.access_work_desc')}>
          {t('ui.settings.access_work_value')}
        </Row>
      </Group>
    </>
  );
}
