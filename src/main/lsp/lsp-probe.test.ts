import { describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../shared/repo-types'
import { probeRepoLanguageServers, type LspProbeDeps } from './lsp-probe'

const repo: Repo = {
  id: 'r',
  path: '/repo',
  displayName: 'r',
  badgeColor: '#000000',
  addedAt: 0,
  languageServers: { enabled: { 'ruby-lsp': true, solargraph: true } }
}

function deps(overrides: Partial<LspProbeDeps> = {}): LspProbeDeps {
  return {
    loginShellEnv: async () => ({ PATH: '/shims' }),
    resolveOnPath: async (name) => (name === 'ruby-lsp' ? '/shims/ruby-lsp' : null),
    run: vi.fn(async () => ({
      code: 0,
      signal: null,
      stdout: '0.26.1\n',
      stderr: '',
      timedOut: false
    })),
    runWsl: vi.fn(async () => ({
      environmentResolved: true,
      code: 0,
      stdout: 'Phpactor 2026.10.07.0\n',
      stderr: '',
      timedOut: false
    })),
    ...overrides
  }
}

describe('probeRepoLanguageServers', () => {
  it('reports bundled, installed and missing servers', async () => {
    expect(await probeRepoLanguageServers(repo, deps())).toEqual({
      typescript: { status: 'bundled' },
      'ruby-lsp': { status: 'installed', version: '0.26.1' },
      solargraph: { status: 'missing' }
    })
  })

  it('treats a failing --version (e.g. an rbenv shim without the gem) as missing', async () => {
    const result = await probeRepoLanguageServers(
      repo,
      deps({
        run: async () => ({
          code: 127,
          signal: null,
          stdout: '',
          stderr: 'rbenv: ruby-lsp: command not found',
          timedOut: false
        })
      })
    )
    expect(result['ruby-lsp']).toEqual({ status: 'missing' })
  })

  it('reports a server without a version flag as installed once it is on PATH, without running it', async () => {
    const d = deps({ resolveOnPath: vi.fn(async (name: string) => `/bin/${name}`) })
    const result = await probeRepoLanguageServers(
      { ...repo, languageServers: { enabled: { intelephense: true } } },
      d
    )
    expect(result.intelephense).toEqual({ status: 'installed', version: '' })
    expect(d.run).not.toHaveBeenCalled()
  })

  it('reports a server without a version flag as missing when it is not on PATH', async () => {
    const result = await probeRepoLanguageServers(
      { ...repo, languageServers: { enabled: { intelephense: true } } },
      deps()
    )
    expect(result.intelephense).toEqual({ status: 'missing' })
  })

  it('reports unsupported-host for remote repos without spawning', async () => {
    const d = deps()
    const result = await probeRepoLanguageServers({ ...repo, connectionId: 'ssh-1' }, d)
    expect(result['ruby-lsp']).toEqual({ status: 'unsupported-host' })
    expect(d.run).not.toHaveBeenCalled()
  })

  it('never runs the command of a server that is not enabled', async () => {
    const d = deps({ resolveOnPath: vi.fn(async (name: string) => `/shims/${name}`) })
    const result = await probeRepoLanguageServers(
      {
        ...repo,
        languageServers: {
          enabled: { solargraph: true },
          command: { 'ruby-lsp': ['bundle', 'exec', 'ruby-lsp'] }
        }
      },
      d
    )
    expect(result['ruby-lsp']).toBeUndefined()
    expect(d.resolveOnPath).not.toHaveBeenCalledWith('bundle', expect.anything())
    expect(d.run).toHaveBeenCalledTimes(1)
    expect(d.run).not.toHaveBeenCalledWith(expect.objectContaining({ program: '/shims/bundle' }))
  })

  describe('repo inside a WSL distro', () => {
    const wslRepo: Repo = {
      ...repo,
      path: '\\\\wsl.localhost\\Ubuntu\\home\\u\\app',
      languageServers: { enabled: { phpactor: true, intelephense: true } }
    }

    it('runs the version command inside the distro and never on the Windows side', async () => {
      const d = deps({ resolveOnPath: vi.fn(async () => null) })
      const result = await probeRepoLanguageServers(
        { ...wslRepo, languageServers: { enabled: { phpactor: true } } },
        d
      )
      expect(result.phpactor).toEqual({ status: 'installed', version: 'Phpactor 2026.10.07.0' })
      expect(d.runWsl).toHaveBeenCalledWith({
        distro: 'Ubuntu',
        program: 'phpactor',
        args: ['language-server', '--version'],
        cwd: '/home/u/app',
        loginPath: 'preferred',
        timeoutMs: 10_000,
        maxOutputBytes: 64 * 1024
      })
      expect(d.run).not.toHaveBeenCalled()
      expect(d.resolveOnPath).not.toHaveBeenCalled()
    })

    it('reports missing when the command fails in the distro', async () => {
      const result = await probeRepoLanguageServers(
        wslRepo,
        deps({
          runWsl: async () => ({
            environmentResolved: true,
            code: 127,
            stdout: '',
            stderr: 'not found',
            timedOut: false
          })
        })
      )
      expect(result.phpactor).toEqual({ status: 'missing' })
    })

    it('reports missing when wsl.exe cannot be spawned', async () => {
      const result = await probeRepoLanguageServers(
        wslRepo,
        deps({
          runWsl: async () => {
            throw new Error('spawn wsl.exe ENOENT')
          }
        })
      )
      expect(result.phpactor).toEqual({ status: 'missing' })
    })

    it('checks a server without a version flag with command -v in the distro', async () => {
      const d = deps({
        runWsl: vi.fn(async () => ({
          environmentResolved: true,
          code: 0,
          stdout: '/home/u/.nvm/bin/intelephense\n',
          stderr: '',
          timedOut: false
        }))
      })
      const result = await probeRepoLanguageServers(wslRepo, d)
      expect(result.intelephense).toEqual({ status: 'installed', version: '' })
      expect(d.runWsl).toHaveBeenCalledWith(
        expect.objectContaining({
          distro: 'Ubuntu',
          script: 'command -v "$1"',
          args: ['intelephense'],
          cwd: '/home/u/app',
          loginPath: 'preferred'
        })
      )
    })

    it('reports a server without a version flag as missing when command -v fails', async () => {
      const result = await probeRepoLanguageServers(
        wslRepo,
        deps({
          runWsl: async () => ({
            environmentResolved: true,
            code: 1,
            stdout: '',
            stderr: '',
            timedOut: false
          })
        })
      )
      expect(result.intelephense).toEqual({ status: 'missing' })
    })

    it('does not run a server that is not enabled', async () => {
      const d = deps()
      await probeRepoLanguageServers({ ...wslRepo, languageServers: { enabled: {} } }, d)
      expect(d.runWsl).not.toHaveBeenCalled()
    })
  })
})
