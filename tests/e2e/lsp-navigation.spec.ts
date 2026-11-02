import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { test as base, expect } from './helpers/orca-app'
import {
  enableLanguageServer,
  openActiveWorktreeFile,
  provideCommittedFixtureRepo
} from './helpers/lsp-navigation-fixture'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'

const SCREENS_DIR = process.env.ORCA_E2E_LSP_SCREENS_DIR
const HOVER_DOC = 'Greets people from the LSP navigation fixture.'
const CLASS_LINE = 4

const FIXTURE_FILES: [string, string][] = [
  ['tsconfig.json', '{"compilerOptions":{"strict":true,"module":"esnext","target":"es2022"}}\n'],
  [
    'src/greeter.ts',
    [
      '// LSP navigation fixture.',
      '',
      `/** ${HOVER_DOC} */`,
      'export class Greeter {',
      '  greet(name: string): string {',
      '    return `hi ${name}`',
      '  }',
      '}',
      ''
    ].join('\n')
  ],
  [
    'src/app.ts',
    [
      "import { Greeter } from './greeter'",
      '',
      "export const message = new Greeter().greet('orca')",
      ''
    ].join('\n')
  ]
]

const test = base.extend({
  minimumSeededWorktreeCount: 1,
  // oxlint-disable-next-line no-empty-pattern -- Playwright fixture callbacks require object destructuring here.
  seededRepoPath: async ({}, provideFixture) => {
    await provideCommittedFixtureRepo((repo) => {
      for (const [name, content] of FIXTURE_FILES) {
        const file = path.join(repo, name)
        mkdirSync(path.dirname(file), { recursive: true })
        writeFileSync(file, content)
      }
    }, provideFixture)
  }
})

test('TypeScript language server provides hover and go-to-definition', async ({ orcaPage }) => {
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)

  await enableLanguageServer(orcaPage, 'typescript')
  await openActiveWorktreeFile(orcaPage, 'src/app.ts', 'typescript')

  const usage = orcaPage
    .locator('.monaco-editor:visible .view-line')
    .filter({ hasText: 'new Greeter' })
    .locator('span', { hasText: /^Greeter$/ })
    .last()
  await expect(usage).toBeVisible({ timeout: 25_000 })

  // Why: the JSDoc lives only in greeter.ts on disk, which no Monaco model holds yet.
  const hover = orcaPage.locator('.monaco-hover:visible').filter({ hasText: HOVER_DOC })
  await expect
    .poll(
      async () => {
        await orcaPage.mouse.move(0, 0)
        await usage.hover()
        return hover
          .waitFor({ state: 'visible', timeout: 3_000 })
          .then(() => true)
          .catch(() => false)
      },
      { timeout: 45_000, intervals: [500] }
    )
    .toBe(true)
  await expect(hover).toContainText('new Greeter(): Greeter')
  if (SCREENS_DIR) {
    await orcaPage.screenshot({ path: path.join(SCREENS_DIR, 'lsp-e2e-hover.png') })
  }

  await orcaPage.mouse.move(0, 0)
  await usage.click()
  await orcaPage.keyboard.press('F12')

  await expect(orcaPage.locator('.editor-header-path:visible')).toContainText('greeter.ts', {
    timeout: 15_000
  })
  await expect(
    orcaPage.locator('.monaco-editor:visible .line-numbers.active-line-number')
  ).toHaveText(String(CLASS_LINE), { timeout: 10_000 })
  if (SCREENS_DIR) {
    await orcaPage.screenshot({ path: path.join(SCREENS_DIR, 'lsp-e2e-definition.png') })
  }
})
