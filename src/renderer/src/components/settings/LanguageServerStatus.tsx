import { translate } from '@/i18n/i18n'
import { SettingsBadge } from './SettingsFormControls'
import type { LanguageServerProbe } from '../../../../shared/language-server-types'

const KEY = 'auto.components.settings.RepositoryLanguageServersSection'

export function LanguageServerStatus({
  probe
}: {
  probe: LanguageServerProbe | undefined
}): React.JSX.Element | null {
  if (!probe) {
    return null
  }
  switch (probe.status) {
    case 'bundled':
      return <SettingsBadge>{translate(`${KEY}.bundled`, 'Bundled')}</SettingsBadge>
    case 'installed':
      return (
        <SettingsBadge>{probe.version || translate(`${KEY}.installed`, 'Installed')}</SettingsBadge>
      )
    case 'missing':
      return (
        <SettingsBadge tone="muted">
          {translate(`${KEY}.notInstalled`, 'Not installed')}
        </SettingsBadge>
      )
    case 'unsupported-host':
      return null
  }
}
