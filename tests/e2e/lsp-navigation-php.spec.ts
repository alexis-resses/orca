import { accessSync, constants, cpSync } from 'node:fs'
import path from 'node:path'
import type { Locator, Page } from '@stablyai/playwright-test'
import { test as base, expect } from './helpers/orca-app'
import {
  enableLanguageServer,
  openActiveWorktreeFile,
  provideCommittedFixtureRepo
} from './helpers/lsp-navigation-fixture'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'

const SCREENS_DIR = process.env.ORCA_E2E_LSP_SCREENS_DIR
const FIXTURES_DIR = path.resolve(__dirname, '../../src/main/lsp/__fixtures__')
type PhpServerId = 'phpactor' | 'intelephense'
const PHP_SERVERS: PhpServerId[] = ['phpactor', 'intelephense']

type Target = { file: string; line: number }
type Navigation = {
  title: string
  origin: string
  lineText: string
  token: string
  // Why: null marks a documented limit of that server; the case is not asserted.
  expected: Record<PhpServerId, Target | null>
}

const GREETER: Target = { file: 'src/Greeter.php', line: 7 }
const GREET_METHOD: Target = { file: 'src/Greeter.php', line: 15 }
const MAILER: Target = { file: 'src/Service/Mailer.php', line: 9 }
const COMPOSER_NAVIGATIONS: Navigation[] = [
  {
    title: 'class from `new`',
    origin: 'src/app.php',
    lineText: 'new Greeter',
    token: 'Greeter',
    expected: { phpactor: GREETER, intelephense: GREETER }
  },
  {
    title: 'method from `->greet`',
    origin: 'src/app.php',
    lineText: '$greeter->greet',
    token: 'greet',
    expected: { phpactor: GREET_METHOD, intelephense: GREET_METHOD }
  },
  {
    title: 'method from `$this->greeter->greet`',
    origin: 'src/Service/Mailer.php',
    lineText: '$this->greeter->greet',
    token: 'greet',
    expected: { phpactor: GREET_METHOD, intelephense: GREET_METHOD }
  },
  {
    title:
      'class with a constructor (Intelephense returns class and constructor, so Monaco opens a peek)',
    origin: 'src/app.php',
    lineText: 'new Mailer',
    token: 'Mailer',
    expected: { phpactor: MAILER, intelephense: null }
  }
]

const INVOICE: Target = { file: 'classes/Invoice.php', line: 5 }
const CUSTOMER_NAME: Target = { file: 'classes/Customer.php', line: 5 }
const LEGACY_NAVIGATIONS: Navigation[] = [
  {
    title: 'global function after require_once',
    origin: 'index.php',
    lineText: 'format_amount(12.5)',
    token: 'format_amount',
    expected: {
      phpactor: { file: 'lib/functions.php', line: 11 },
      intelephense: { file: 'lib/functions.php', line: 11 }
    }
  },
  {
    title: 'class without namespace from `new`',
    origin: 'index.php',
    lineText: 'new Invoice',
    token: 'Invoice',
    expected: { phpactor: INVOICE, intelephense: INVOICE }
  },
  {
    title: 'define() constant',
    origin: 'index.php',
    lineText: 'echo TAX_RATE',
    token: 'TAX_RATE',
    expected: {
      phpactor: { file: 'lib/functions.php', line: 3 },
      intelephense: { file: 'lib/functions.php', line: 3 }
    }
  },
  {
    title: 'chained call through a method documented with @return',
    origin: 'index.php',
    lineText: '>documentedCustomer()->name',
    token: 'name',
    expected: { phpactor: CUSTOMER_NAME, intelephense: CUSTOMER_NAME }
  },
  {
    title: 'chained call through a method without @return',
    origin: 'index.php',
    lineText: '>undocumentedCustomer()->name',
    token: 'name',
    expected: { phpactor: null, intelephense: CUSTOMER_NAME }
  }
]

function isOnPath(executable: string): boolean {
  const extensions = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : ['']
  return (process.env.PATH ?? '')
    .split(path.delimiter)
    .filter(Boolean)
    .some((directory) =>
      extensions.some((extension) => {
        try {
          accessSync(path.join(directory, `${executable}${extension}`), constants.X_OK)
          return true
        } catch {
          return false
        }
      })
    )
}

function fixtureTest(fixtureName: string) {
  return base.extend({
    minimumSeededWorktreeCount: 1,
    // oxlint-disable-next-line no-empty-pattern -- Playwright fixture callbacks require object destructuring here.
    seededRepoPath: async ({}, provideFixture) => {
      await provideCommittedFixtureRepo(
        (repo) => cpSync(path.join(FIXTURES_DIR, fixtureName), repo, { recursive: true }),
        provideFixture
      )
    }
  })
}

function headerPattern(target: Target): RegExp {
  const separator = '[\\\\/]'
  return new RegExp(target.file.split('/').join(separator).replace('.', '\\.'))
}

async function tokenLocator(page: Page, lineText: string, token: string) {
  // Why: Monaco's PHP tokenizer folds a leading space or `->` (even `->a->b`) or a trailing `;` into the identifier's span.
  const exactToken = new RegExp(`(^|[\\s>:])${token};?$`)
  return page
    .locator('.monaco-editor:visible .view-line')
    .filter({ hasText: lineText })
    .locator('span', { hasText: exactToken })
    .last()
}

async function clickInsideToken(page: Page, span: Locator, token: string): Promise<void> {
  const text = (await span.textContent()) ?? ''
  const box = await span.boundingBox()
  if (!box || !text) {
    throw new Error(`Cannot locate "${token}" in a span`)
  }
  // Why: the editor font is monospace, so a character offset maps linearly onto the span width.
  const middle = text.lastIndexOf(token) + token.length / 2
  await page.mouse.click(box.x + (middle / text.length) * box.width, box.y + box.height / 2)
}

async function goToDefinition(page: Page, navigation: Navigation, target: Target): Promise<void> {
  // Why: the server may still be indexing; retry until the definition resolves.
  await expect
    .poll(
      async () => {
        await openActiveWorktreeFile(page, navigation.origin, 'php')
        const token = await tokenLocator(page, navigation.lineText, navigation.token)
        await token.waitFor({ state: 'visible', timeout: 10_000 })
        await page.mouse.move(0, 0)
        await clickInsideToken(page, token, navigation.token)
        await page.keyboard.press('F12')
        return page
          .locator('.editor-header-path:visible')
          .filter({ hasText: headerPattern(target) })
          .waitFor({ state: 'visible', timeout: 4_000 })
          .then(() => true)
          .catch(() => false)
      },
      { timeout: 60_000, intervals: [500] }
    )
    .toBe(true)
  await expect(page.locator('.monaco-editor:visible .line-numbers.active-line-number')).toHaveText(
    String(target.line),
    { timeout: 10_000 }
  )
}

function registerNavigationTests(
  test: ReturnType<typeof fixtureTest>,
  fixtureName: string,
  navigations: Navigation[]
): void {
  for (const serverId of PHP_SERVERS) {
    const define = isOnPath(serverId) ? test : test.skip
    define(`${serverId} resolves definitions in ${fixtureName}`, async ({ orcaPage }) => {
      test.setTimeout(240_000)
      await waitForSessionReady(orcaPage)
      await waitForActiveWorktree(orcaPage)
      await enableLanguageServer(orcaPage, serverId)

      for (const navigation of navigations) {
        const target = navigation.expected[serverId]
        if (!target) {
          continue
        }
        await test.step(navigation.title, () => goToDefinition(orcaPage, navigation, target))
        if (SCREENS_DIR) {
          await orcaPage.screenshot({
            path: path.join(SCREENS_DIR, `lsp-e2e-${serverId}-${fixtureName}.png`)
          })
        }
      }
    })
  }
}

const composerTest = fixtureTest('php-project')
registerNavigationTests(composerTest, 'php-project', COMPOSER_NAVIGATIONS)

for (const serverId of PHP_SERVERS) {
  const define = isOnPath(serverId) ? composerTest : composerTest.skip
  define(`${serverId} shows the docblock on hover in php-project`, async ({ orcaPage }) => {
    composerTest.setTimeout(240_000)
    await waitForSessionReady(orcaPage)
    await waitForActiveWorktree(orcaPage)
    await enableLanguageServer(orcaPage, serverId)
    await openActiveWorktreeFile(orcaPage, 'src/app.php', 'php')

    const usage = await tokenLocator(orcaPage, '$greeter->greet', 'greet')
    await expect(usage).toBeVisible({ timeout: 25_000 })
    // Why: the docblock lives only in Greeter.php on disk, which no Monaco model holds yet.
    const hover = orcaPage
      .locator('.monaco-hover:visible')
      .filter({ hasText: 'Builds the greeting shown to a user.' })
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
        { timeout: 60_000, intervals: [500] }
      )
      .toBe(true)
    await expect(hover).toContainText('greet')
  })
}

registerNavigationTests(fixtureTest('php-legacy-project'), 'php-legacy-project', LEGACY_NAVIGATIONS)
