import { useCallback, useEffect, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { resetLspClients } from '@/lib/lsp/lsp-session-opener'
import { SettingsSwitchRow } from './SettingsFormControls'
import { SearchableSetting } from './SearchableSetting'
import { matchesSettingsSearch, type SettingsSearchEntry } from './settings-search'
import { LanguageServerChoiceRow } from './LanguageServerChoiceRow'
import { LanguageServerStatus } from './LanguageServerStatus'
import { getLanguageServerChoiceGroups } from './language-server-choice-groups'
import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import type {
  LanguageServerId,
  LspProbeResult,
  RepoLanguageServerSettings
} from '../../../../shared/language-server-types'
import type { Repo } from '../../../../shared/repo-types'

type Props = {
  repo: Repo
  updateRepo: (repoId: string, updates: Pick<Repo, 'languageServers'>) => void | Promise<boolean>
  forceVisible: boolean
  searchQuery: string
  searchEntries: SettingsSearchEntry[]
}
const KEY = 'auto.components.settings.RepositoryLanguageServersSection'

function languageLabel(languageId: string): string {
  switch (languageId) {
    case 'ruby':
      return translate(`${KEY}.ruby`, 'Ruby')
    case 'php':
      return translate(`${KEY}.php`, 'PHP')
    default:
      return languageId
  }
}

const CHOICE_GROUPS = getLanguageServerChoiceGroups()

export function RepositoryLanguageServersSection({
  repo,
  updateRepo,
  forceVisible,
  searchQuery,
  searchEntries
}: Props): React.JSX.Element {
  const [probe, setProbe] = useState<LspProbeResult | null>(null)
  const [probeNonce, setProbeNonce] = useState(0)
  const refreshProbe = useCallback((): void => setProbeNonce((n) => n + 1), [])
  const isLocal = getRepoExecutionHostId(repo) === LOCAL_EXECUTION_HOST_ID
  const settings = repo.languageServers
  useEffect(() => {
    let cancelled = false
    void window.api.lsp.probe({ repoId: repo.id }).then(
      (result) => {
        if (!cancelled) {
          setProbe(result)
        }
      },
      () => {
        if (!cancelled) {
          setProbe(null)
        }
      }
    )
    return () => {
      cancelled = true
    }
  }, [repo.id, settings?.command, settings?.enabled, probeNonce])

  const persist = (next: RepoLanguageServerSettings): void => {
    // Why: running sessions only restart once the new setting is actually persisted.
    void Promise.resolve(updateRepo(repo.id, { languageServers: next })).then((ok) => {
      if (ok !== false) {
        resetLspClients()
      }
    })
  }
  const setEnabled = (next: Partial<Record<LanguageServerId, boolean>>): void =>
    persist({ ...settings, enabled: { ...settings?.enabled, ...next } })
  const chooseServer = (serverIds: LanguageServerId[], chosen: LanguageServerId | null): void =>
    setEnabled(Object.fromEntries(serverIds.map((serverId) => [serverId, serverId === chosen])))
  const saveCommand = (serverId: LanguageServerId, text: string): void => {
    // Why: plain whitespace split; quoted paths with spaces are not supported.
    const argv = text.trim().split(/\s+/).filter(Boolean)
    if (argv.join(' ') === (settings?.command?.[serverId]?.join(' ') ?? '')) {
      return
    }
    persist({
      ...settings,
      command: { ...settings?.command, [serverId]: argv.length > 0 ? argv : undefined }
    })
  }

  return (
    <SearchableSetting
      title={translate(`${KEY}.title`, 'Language Servers')}
      description={translate(
        `${KEY}.description`,
        'Go to definition, find references and hover for this project. Enabling a server runs code from this repository.'
      )}
      keywords={searchEntries[0]?.keywords}
      forceVisible={forceVisible || matchesSettingsSearch(searchQuery, searchEntries)}
      className="space-y-1"
    >
      {!isLocal && (
        <p className="text-muted-foreground text-xs">
          {translate(`${KEY}.localOnly`, 'Language servers are available for local projects only.')}
        </p>
      )}
      <SettingsSwitchRow
        label={translate(`${KEY}.typescript`, 'TypeScript / JavaScript')}
        description={<LanguageServerStatus probe={probe?.typescript} />}
        checked={Boolean(settings?.enabled?.typescript)}
        disabled={!isLocal}
        onChange={() => setEnabled({ typescript: !settings?.enabled?.typescript })}
      />
      {CHOICE_GROUPS.map(({ languageId, serverIds }) => (
        <LanguageServerChoiceRow
          key={languageId}
          repoId={repo.id}
          repoPath={repo.path}
          languageId={languageId}
          label={languageLabel(languageId)}
          serverIds={serverIds}
          settings={settings}
          probe={probe}
          isLocal={isLocal}
          onChoose={(chosen) => chooseServer(serverIds, chosen)}
          onSaveCommand={saveCommand}
          onProbeStale={refreshProbe}
        />
      ))}
    </SearchableSetting>
  )
}
