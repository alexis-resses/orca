import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { resolveLspServerCommand, type LspServerCommandDeps } from './lsp-server-command'
import { buildWslSpawnCommand } from '../wsl/wsl-runner'

vi.mock('../wsl/wsl-executable-path', () => ({
  resolveWslExecutablePath: () => 'C:\\Windows\\System32\\wsl.exe'
}))
vi.mock('../wsl-interop-spawn-directory', () => ({
  resolveWslInteropSpawnCwd: () => 'C:\\Users\\me'
}))
vi.mock('../wsl/wsl-guest-environment', () => ({
  getWslGuestEnvironment: () => hoisted.environment()
}))
const hoisted = vi.hoisted(() => {
  type GuestEnvironment = { path: string; home: string; envBinary: string }
  return {
    environment: vi.fn(async (): Promise<GuestEnvironment | null> => ({
      path: '/home/u/.nvm/bin:/usr/bin',
      home: '/home/u',
      envBinary: '/usr/bin/env'
    }))
  }
})

function deps(overrides: Partial<LspServerCommandDeps> = {}): LspServerCommandDeps {
  return {
    platform: 'darwin',
    loginShellEnv: async () => ({ PATH: '/shims:/usr/bin' }),
    resolveOnPath: vi.fn(async (name: string) => `/shims/${name}`),
    fileExists: async () => false,
    bundledTypescriptPaths: () => ({ cliPath: '/b/cli.mjs', tsserverPath: '/b/tsserver.js' }),
    buildWslSpawn: buildWslSpawnCommand,
    ...overrides
  }
}

describe('resolveLspServerCommand', () => {
  it('runs the bundled TypeScript server through Electron-as-Node', async () => {
    const resolved = await resolveLspServerCommand('typescript', '/repo', undefined, deps())
    expect(resolved?.command.program).toBe(process.execPath)
    expect(resolved?.command.args).toEqual(['/b/cli.mjs', '--stdio'])
    expect(resolved?.command.env.ELECTRON_RUN_AS_NODE).toBe('1')
    expect(resolved?.initializationOptions).toEqual({ tsserver: { path: '/b/tsserver.js' } })
  })

  it('prefers the project tsserver when it exists', async () => {
    const resolved = await resolveLspServerCommand(
      'typescript',
      '/repo',
      undefined,
      deps({ fileExists: async (p) => p.endsWith('tsserver.js') })
    )
    expect(resolved?.initializationOptions).toEqual({
      tsserver: { path: join('/repo', 'node_modules', 'typescript', 'lib', 'tsserver.js') }
    })
  })

  it('resolves ruby-lsp on the login-shell PATH from the project root', async () => {
    const d = deps()
    const resolved = await resolveLspServerCommand('ruby-lsp', '/repo', undefined, d)
    expect(d.resolveOnPath).toHaveBeenCalledWith('ruby-lsp', {
      env: { PATH: '/shims:/usr/bin' },
      cwd: '/repo',
      platform: 'darwin'
    })
    expect(resolved?.command).toEqual({
      program: '/shims/ruby-lsp',
      args: [],
      env: { PATH: '/shims:/usr/bin' }
    })
  })

  it('uses the custom argv override', async () => {
    const resolved = await resolveLspServerCommand(
      'ruby-lsp',
      '/repo',
      { command: { 'ruby-lsp': ['bundle', 'exec', 'ruby-lsp'] } },
      deps()
    )
    expect(resolved?.command.program).toBe('/shims/bundle')
    expect(resolved?.command.args).toEqual(['exec', 'ruby-lsp'])
  })

  it('returns null when the program is not on PATH', async () => {
    const resolved = await resolveLspServerCommand(
      'solargraph',
      '/repo',
      undefined,
      deps({ resolveOnPath: async () => null })
    )
    expect(resolved).toBeNull()
  })

  describe('repo inside a WSL distro', () => {
    const wslRoot = '\\\\wsl.localhost\\Ubuntu\\home\\u\\app'
    const guestCommand = (linuxRoot: string, ...rest: string[]): string[] => [
      '-d',
      'Ubuntu',
      '--exec',
      'sh',
      '-c',
      'cd "$1" || exit 1; shift; exec "$@"',
      'orca-wsl',
      linuxRoot,
      '/usr/bin/env',
      'PATH=/home/u/.nvm/bin:/usr/bin',
      'HOME=/home/u',
      ...rest
    ]

    it('launches the server through wsl.exe --exec with the Windows interop cwd', async () => {
      const d = deps({ platform: 'win32' })
      const resolved = await resolveLspServerCommand('phpactor', wslRoot, undefined, d)
      expect(resolved?.command.program).toBe('C:\\Windows\\System32\\wsl.exe')
      expect(resolved?.command.args).toEqual(
        guestCommand('/home/u/app', 'phpactor', 'language-server')
      )
      expect(resolved?.command.cwd).toBe('C:\\Users\\me')
      expect(resolved?.wsl).toEqual({ distro: 'Ubuntu', linuxRoot: '/home/u/app' })
      expect(resolved?.command.env.WSL_UTF8).toBe('1')
      expect(d.resolveOnPath).not.toHaveBeenCalled()
    })

    it('uses the custom argv override inside the distro', async () => {
      const resolved = await resolveLspServerCommand(
        'intelephense',
        wslRoot,
        { command: { intelephense: ['node', '/opt/intelephense.js', '--stdio'] } },
        deps()
      )
      expect(resolved?.command.args).toEqual(
        guestCommand('/home/u/app', 'node', '/opt/intelephense.js', '--stdio')
      )
    })

    it('still launches, on the distro default PATH, when the login PATH probe failed', async () => {
      hoisted.environment.mockResolvedValueOnce(null)
      {
        const resolved = await resolveLspServerCommand('phpactor', wslRoot, undefined, deps())
        expect(resolved?.command.args).toEqual([
          '-d',
          'Ubuntu',
          '--exec',
          'sh',
          '-c',
          'cd "$1" || exit 1; shift; exec "$@"',
          'orca-wsl',
          '/home/u/app',
          'phpactor',
          'language-server'
        ])
      }
    })

    it('refuses an override that is a shell string', async () => {
      await expect(
        resolveLspServerCommand(
          'phpactor',
          wslRoot,
          { command: { phpactor: ['phpactor; rm -rf /'] } },
          deps()
        )
      ).rejects.toThrow('single binary')
    })

    it('keeps the bundled TypeScript server on the Windows side', async () => {
      const resolved = await resolveLspServerCommand('typescript', wslRoot, undefined, deps())
      expect(resolved?.command.program).toBe(process.execPath)
      expect(resolved?.command.cwd).toBeUndefined()
      expect(resolved?.wsl).toBeUndefined()
    })

    it('leaves a native repo untouched', async () => {
      const resolved = await resolveLspServerCommand('phpactor', '/repo', undefined, deps())
      expect(resolved?.command.cwd).toBeUndefined()
      expect(resolved?.wsl).toBeUndefined()
    })
  })
})
