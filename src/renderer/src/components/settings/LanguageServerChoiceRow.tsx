import { useCallback, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { SettingsRow } from './SettingsFormControls'
import { LanguageServerInstallPanel } from './LanguageServerInstallPanel'
import { LanguageServerStatus } from './LanguageServerStatus'
import { useAppStore } from '@/store'
import { installAppliesToShell, installShellFamily } from './language-server-install-command'
import { LANGUAGE_SERVER_CATALOG } from '../../../../shared/language-server-catalog'
import type {
  LanguageServerId,
  LspProbeResult,
  RepoLanguageServerSettings
} from '../../../../shared/language-server-types'

const KEY = 'auto.components.settings.RepositoryLanguageServersSection'

type InstallRun = { serverId: LanguageServerId; mode: 'install' | 'update' }

type Props = {
  repoId: string
  repoPath: string
  languageId: string
  label: string
  serverIds: LanguageServerId[]
  settings: RepoLanguageServerSettings | undefined
  probe: LspProbeResult | null
  isLocal: boolean
  onChoose: (serverId: LanguageServerId | null) => void
  onSaveCommand: (serverId: LanguageServerId, text: string) => void
  onProbeStale: () => void
}

export function LanguageServerChoiceRow({
  repoId,
  repoPath,
  languageId,
  label,
  serverIds,
  settings,
  probe,
  isLocal,
  onChoose,
  onSaveCommand,
  onProbeStale
}: Props): React.JSX.Element {
  const windowsShell = useAppStore((s) => s.settings?.terminalWindowsShell)
  const [installing, setInstalling] = useState<InstallRun | null>(null)
  // Why: null means the exit code was unknown; the fresh probe decides whether it worked.
  const [finishedCode, setFinishedCode] = useState<number | null | undefined>(undefined)
  const closeInstall = useCallback((): void => {
    setInstalling(null)
    setFinishedCode(undefined)
  }, [])
  const handleInstallFinished = useCallback(
    (exitCode: number | null): void => {
      onProbeStale()
      if (exitCode === 0) {
        closeInstall()
      } else {
        setFinishedCode(exitCode)
      }
    },
    [onProbeStale, closeInstall]
  )
  const handleInstallExit = useCallback((): void => {
    onProbeStale()
    closeInstall()
  }, [onProbeStale, closeInstall])

  const choice = serverIds.find((serverId) => settings?.enabled?.[serverId]) ?? null
  const choiceProbe = choice ? probe?.[choice] : undefined
  const choiceEntry = choice ? LANGUAGE_SERVER_CATALOG[choice] : null
  const choiceCommand = choice ? (settings?.command?.[choice]?.join(' ') ?? '') : ''
  const canManageInstall =
    choiceEntry?.kind === 'external' &&
    installAppliesToShell(
      choiceEntry.installShells,
      installShellFamily(windowsShell, navigator.userAgent.includes('Windows'))
    )
  const showInstall =
    installing !== null && !(finishedCode === null && choiceProbe?.status === 'installed')
  const startInstall = (serverId: LanguageServerId, mode: InstallRun['mode']): void => {
    setFinishedCode(undefined)
    setInstalling({ serverId, mode })
  }
  const labelId = `lsp-${languageId}-${repoId}`
  const commandLabelId = `lsp-command-label-${languageId}-${repoId}`

  return (
    <>
      <SettingsRow
        label={label}
        labelId={labelId}
        description={choice ? <LanguageServerStatus probe={probe?.[choice]} /> : undefined}
        control={
          <Select
            value={choice ?? 'off'}
            disabled={!isLocal}
            onValueChange={(value) => {
              // Why: an install panel belongs to the previous server and must not linger under the new one.
              closeInstall()
              onChoose(serverIds.find((serverId) => serverId === value) ?? null)
            }}
          >
            <SelectTrigger className="w-40" aria-labelledby={labelId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">{translate(`${KEY}.off`, 'Off')}</SelectItem>
              {serverIds.map((serverId) => (
                <SelectItem key={serverId} value={serverId}>
                  {LANGUAGE_SERVER_CATALOG[serverId].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      {isLocal && choice && choiceEntry?.kind === 'external' && (
        <>
          {!canManageInstall &&
            (choiceProbe?.status === 'missing' || choiceProbe?.status === 'installed') && (
              <p className="text-muted-foreground text-xs">
                {translate(
                  `${KEY}.installNeedsPosixShell`,
                  'Install this server from a POSIX shell such as Git Bash or WSL.'
                )}
              </p>
            )}
          {canManageInstall &&
            (choiceProbe?.status === 'missing' || choiceProbe?.status === 'installed') && (
              <SettingsRow
                label={translate(`${KEY}.manage`, 'Install or update')}
                control={
                  choiceProbe.status === 'missing' ? (
                    <Button size="sm" onClick={() => startInstall(choice, 'install')}>
                      {translate(`${KEY}.install`, 'Install')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startInstall(choice, 'update')}
                    >
                      {translate(`${KEY}.update`, 'Update')}
                    </Button>
                  )
                }
              />
            )}
          <SettingsRow
            label={translate(`${KEY}.customCommand`, 'Custom command')}
            labelId={commandLabelId}
            control={
              <Input
                key={`${choice}:${choiceCommand}`}
                className="w-64"
                aria-labelledby={commandLabelId}
                defaultValue={choiceCommand}
                placeholder={choiceEntry.defaultCommand.join(' ')}
                onBlur={(event) => onSaveCommand(choice, event.target.value)}
              />
            }
          />
          {installing && showInstall && (
            <LanguageServerInstallPanel
              repoPath={repoPath}
              serverId={installing.serverId}
              mode={installing.mode}
              onFinished={handleInstallFinished}
              onExit={handleInstallExit}
            />
          )}
          {showInstall && finishedCode !== undefined && finishedCode !== null && (
            <SettingsRow
              label={translate(`${KEY}.installFailed`, 'Install failed. Check the output above.')}
              control={
                <Button size="sm" variant="outline" onClick={closeInstall}>
                  {translate(`${KEY}.dismiss`, 'Dismiss')}
                </Button>
              }
            />
          )}
        </>
      )}
    </>
  )
}
