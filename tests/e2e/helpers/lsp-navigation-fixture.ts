import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Page } from '@stablyai/playwright-test'
import { expect } from '@stablyai/playwright-test'
import { runProcess } from '@orca/process-host'
import type { LanguageServerId } from '../../../src/shared/language-server-types'

async function git(cwd: string, args: string[]): Promise<void> {
  const result = await runProcess({ program: 'git', args, cwd })
  if (result.code !== 0) {
    throw new Error(result.stderr)
  }
}

export async function provideCommittedFixtureRepo(
  populate: (repo: string) => void | Promise<void>,
  provideFixture: (repo: string) => Promise<void>
): Promise<void> {
  // Why: realpath so the worktree path and server-reported URIs agree on macOS /var -> /private/var.
  const fixtureRoot = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'orca-lsp-nav-')))
  const repo = path.join(fixtureRoot, 'repo')
  await populate(repo)
  await git(repo, ['init', '-q', '-b', 'main'])
  await git(repo, ['config', 'user.email', 'lsp-nav@example.invalid'])
  await git(repo, ['config', 'user.name', 'LSP nav'])
  await git(repo, ['add', '.'])
  await git(repo, ['commit', '-q', '-m', 'LSP fixture'])
  try {
    await provideFixture(repo)
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true })
  }
}

export async function enableLanguageServer(page: Page, serverId: LanguageServerId): Promise<void> {
  // Why: enable before opening a file; the renderer caches an open refusal for a few seconds.
  const enabled = await page.evaluate(async (id) => {
    const state = window.__store!.getState()
    const worktree = Object.values(state.worktreesByRepo)
      .flat()
      .find((entry) => entry.id === state.activeWorktreeId)!
    return state.updateRepo(worktree.repoId, { languageServers: { enabled: { [id]: true } } })
  }, serverId)
  expect(enabled).not.toBe(false)
}

export async function openActiveWorktreeFile(
  page: Page,
  relativePath: string,
  language: string
): Promise<void> {
  await page.evaluate(
    ({ relativePath, language }) => {
      const state = window.__store!.getState()
      const worktreeId = state.activeWorktreeId!
      const worktree = Object.values(state.worktreesByRepo)
        .flat()
        .find((entry) => entry.id === worktreeId)!
      const separator = worktree.path.includes('\\') ? '\\' : '/'
      state.openFile({
        filePath: [worktree.path, ...relativePath.split('/')].join(separator),
        relativePath,
        worktreeId,
        language,
        mode: 'edit'
      })
    },
    { relativePath, language }
  )
  await expect(page.locator('.editor-header-path:visible').first()).toContainText(
    path.posix.basename(relativePath),
    { timeout: 20_000 }
  )
}
