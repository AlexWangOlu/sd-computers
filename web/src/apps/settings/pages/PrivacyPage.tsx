import { Camera, HardDrive, LocateFixed, MapPin, Mic, ShieldCheck } from 'lucide-react';
import { t } from '@/i18n';
import { Toggle } from '@/ui/controls';
import { Group, PageHeader, Row } from '../ui';
import { useLocal } from '../local';

/** Privacy & security - cosmetic, but the switches remember their state for the session. */
export default function PrivacyPage() {
  const toggles = useLocal(s => s.toggles);
  const toggle = useLocal(s => s.toggle);
  const sw = (key: string, def: boolean) => {
    const on = toggles[key] ?? def;
    return <Toggle checked={on} onChange={() => toggle(key, def)} label={on ? t('ui.settings.on') : t('ui.settings.off')} />;
  };

  return (
    <>
      <PageHeader title={t('ui.settings.nav_privacy')} />

      <Group title={t('ui.settings.security')}>
        <Row icon={<ShieldCheck size={20} strokeWidth={1.5} />} title={t('ui.settings.win_security')} description={t('ui.settings.win_security_desc')}>
          <span className="text-success">{t('ui.settings.win_security_value')}</span>
        </Row>
        <Row icon={<MapPin size={20} strokeWidth={1.5} />} title={t('ui.settings.find_device')} description={t('ui.settings.find_device_desc')}>
          {sw('find', false)}
        </Row>
        <Row icon={<HardDrive size={20} strokeWidth={1.5} />} title={t('ui.settings.encryption')} description={t('ui.settings.encryption_desc')}>
          {t('ui.settings.on')}
        </Row>
      </Group>

      <Group title={t('ui.settings.app_permissions')}>
        <Row icon={<LocateFixed size={20} strokeWidth={1.5} />} title={t('ui.settings.location')}>
          {sw('location', true)}
        </Row>
        <Row icon={<Camera size={20} strokeWidth={1.5} />} title={t('ui.settings.camera')}>
          {sw('camera', false)}
        </Row>
        <Row icon={<Mic size={20} strokeWidth={1.5} />} title={t('ui.settings.microphone')}>
          {sw('microphone', true)}
        </Row>
      </Group>
    </>
  );
}
