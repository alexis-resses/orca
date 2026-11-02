import type { AgentStartupShell } from '../../../../shared/tui-agent-startup-shell'
import { resolveWindowsShellStartupFamily } from '../../../../shared/windows-terminal-shell'
import { quotePosixShell } from '../../../../shared/wsl-login-shell-command'
import { quotePowerShellLiteral } from '../../../../shared/powershell-native-argument'
import { isWslShellName } from '../../../../shared/local-windows-terminal-runtime'
import { parseWslUncPath } from '../../../../shared/wsl-paths'

export type InstallShellFamily = AgentStartupShell

export function installShellFamily(
  effectiveShell: string | undefined,
  isWindows: boolean
): InstallShellFamily {
  if (isWindows) {
    return resolveWindowsShellStartupFamily(effectiveShell)
  }
  return 'posix'
}

export function resolveInstallShell(
  repoPath: string,
  configuredShell: string | undefined
): string | undefined {
  // Why: a WSL repo always installs through its distro's shell, whatever the Windows default is.
  return parseWslUncPath(repoPath) ? 'wsl.exe' : configuredShell
}

export function buildLanguageServerInstallCommand(
  command: string,
  projectPath: string,
  family: InstallShellFamily,
  effectiveShell?: string
): string {
  const wslRepo = parseWslUncPath(projectPath)
  if (wslRepo) {
    return `cd -- ${quotePosixShell(wslRepo.linuxPath)} && ${command}`
  }
  if (isWslShellName(effectiveShell)) {
    return command
  }

  switch (family) {
    case 'powershell':
      return `Set-Location -LiteralPath ${quotePowerShellLiteral(projectPath)}; ${command}`
    case 'cmd':
      // Why: cmd expands %VAR% even inside double quotes. A path like
      // C:\Users\%TEMP% would redirect to the temp dir. pushd handles this
      // and also supports UNC paths that cd /d rejects.
      if (projectPath.includes('%')) {
        return command
      }
      return `pushd "${projectPath}" && ${command}`
    case 'posix':
      return `cd -- ${quotePosixShell(projectPath)} && ${command}`
  }
}

export function installAppliesToShell(
  installShells: readonly InstallShellFamily[] | undefined,
  family: InstallShellFamily
): boolean {
  return installShells === undefined || installShells.includes(family)
}
