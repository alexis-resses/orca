import {
  LANGUAGE_SERVER_CATALOG,
  type ExternalLanguageServer
} from '../../shared/language-server-catalog'
import {
  LANGUAGE_SERVER_IDS,
  type LanguageServerId,
  type LanguageServerProbe,
  type LspProbeResult
} from '../../shared/language-server-types'
import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import type { Repo } from '../../shared/repo-types'
import { runProcess } from '@orca/process-host'
import type { ProcessResult, ProcessSpec } from '@orca/process-host/process-spec'
import { parseWslUncPath, type WslUncPathInfo } from '../../shared/wsl-paths'
import { runWslProcess, type WslResult, type WslSpec } from '../wsl/wsl-runner'
import { resolveLoginShellEnvironment } from '../startup/login-shell-environment'
import { resolveCommandOnLocalPath, type ResolveCommandOptions } from '../ipc/command-path-resolver'

export type LspProbeDeps = {
  loginShellEnv: () => Promise<NodeJS.ProcessEnv>
  resolveOnPath: (command: string, options: ResolveCommandOptions) => Promise<string | null>
  run: (spec: ProcessSpec) => Promise<ProcessResult>
  runWsl: (spec: WslSpec) => Promise<WslResult>
}

const defaultDeps: LspProbeDeps = {
  loginShellEnv: () => resolveLoginShellEnvironment(),
  resolveOnPath: resolveCommandOnLocalPath,
  run: runProcess,
  runWsl: runWslProcess
}

const WSL_PROBE_TIMEOUT_MS = 10_000
const PROBE_MAX_OUTPUT_BYTES = 64 * 1024

async function probeExternalInWsl(
  target: WslUncPathInfo,
  [name, ...args]: string[],
  versionArgs: readonly string[] | null,
  deps: LspProbeDeps
): Promise<LanguageServerProbe> {
  if (!name) {
    return { status: 'missing' }
  }
  const base = {
    distro: target.distro,
    cwd: target.linuxPath,
    loginPath: 'preferred',
    timeoutMs: WSL_PROBE_TIMEOUT_MS,
    maxOutputBytes: PROBE_MAX_OUTPUT_BYTES
  } as const
  const run = await deps
    .runWsl(
      versionArgs
        ? { ...base, program: name, args: [...args, ...versionArgs] }
        : { ...base, script: 'command -v "$1"', args: [name] }
    )
    .catch(() => null)
  if (!run || run.code !== 0) {
    return { status: 'missing' }
  }
  return { status: 'installed', version: versionArgs ? firstLine(run.stdout) : '' }
}

function firstLine(stdout: string): string {
  return stdout.trim().split('\n')[0] ?? ''
}

async function probeExternal(
  repo: Repo,
  id: LanguageServerId,
  entry: ExternalLanguageServer,
  deps: LspProbeDeps
): Promise<LanguageServerProbe> {
  const [name, ...args] = repo.languageServers?.command?.[id] ?? entry.defaultCommand
  const wslRoot = parseWslUncPath(repo.path)
  if (wslRoot) {
    return probeExternalInWsl(wslRoot, [name, ...args], entry.versionArgs, deps)
  }
  const env = await deps.loginShellEnv()
  const program = name ? await deps.resolveOnPath(name, { env, cwd: repo.path }) : null
  if (!program) {
    return { status: 'missing' }
  }
  if (!entry.versionArgs) {
    return { status: 'installed', version: '' }
  }
  // Why: cwd = project so version-manager shims answer for the project's Ruby, not the global one.
  const run = await deps
    .run({
      program,
      args: [...args, ...entry.versionArgs],
      cwd: repo.path,
      env,
      timeoutMs: 10_000,
      maxOutputBytes: 64 * 1024
    })
    .catch(() => null)
  if (!run || run.code !== 0) {
    return { status: 'missing' }
  }
  return { status: 'installed', version: firstLine(run.stdout) }
}

export async function probeRepoLanguageServers(
  repo: Repo,
  deps: LspProbeDeps = defaultDeps
): Promise<LspProbeResult> {
  const local = getRepoExecutionHostId(repo) === LOCAL_EXECUTION_HOST_ID
  const result: LspProbeResult = {}
  for (const id of LANGUAGE_SERVER_IDS) {
    const entry = LANGUAGE_SERVER_CATALOG[id]
    if (entry.kind === 'bundled') {
      result[id] = { status: 'bundled' }
    } else if (!local) {
      result[id] = { status: 'unsupported-host' }
    } else if (repo.languageServers?.enabled?.[id]) {
      // Why: probing runs the (possibly repo-controlled) command, so only an opted-in server is run.
      result[id] = await probeExternal(repo, id, entry, deps)
    }
  }
  return result
}
