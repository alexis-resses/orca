import { LANGUAGE_SERVER_IDS } from './language-server-types'
import type { AgentStartupShell } from './tui-agent-startup-shell'
import type { LanguageServerId, RepoLanguageServerSettings } from './language-server-types'

type CatalogEntryBase = { label: string; languageIds: readonly string[] }
export type BundledLanguageServer = CatalogEntryBase & { kind: 'bundled' }
export type ExternalLanguageServer = CatalogEntryBase & {
  kind: 'external'
  defaultCommand: readonly string[]
  /** null: the server has no version flag, so being on PATH is the only check. */
  versionArgs: readonly string[] | null
  installCommand: string
  updateCommand: string
  initializationOptions: unknown
  workspaceConfiguration?: Readonly<Record<string, unknown>>
  installShells?: readonly AgentStartupShell[]
}

// Why: the PHAR needs PHP 8.1+; downloading to a temp file keeps a working binary if an update is cut off.
const PHPACTOR_PHAR_INSTALL_COMMAND =
  'mkdir -p ~/.local/bin && curl -fsSL -o ~/.local/bin/phpactor.download https://github.com/phpactor/phpactor/releases/latest/download/phpactor.phar && chmod +x ~/.local/bin/phpactor.download && mv -f ~/.local/bin/phpactor.download ~/.local/bin/phpactor'

export const LANGUAGE_SERVER_CATALOG: Record<
  LanguageServerId,
  BundledLanguageServer | ExternalLanguageServer
> = {
  typescript: {
    kind: 'bundled',
    label: 'TypeScript / JavaScript',
    languageIds: ['typescript', 'javascript']
  },
  'ruby-lsp': {
    kind: 'external',
    label: 'Ruby LSP',
    languageIds: ['ruby'],
    defaultCommand: ['ruby-lsp'],
    versionArgs: ['--version'],
    installCommand: 'gem install ruby-lsp',
    updateCommand: 'gem update ruby-lsp',
    // Why: navigation only; every other feature costs CPU on the indexer for nothing.
    initializationOptions: {
      enabledFeatures: {
        definition: true,
        hover: true,
        workspaceSymbol: true,
        completion: false,
        diagnostics: false,
        formatting: false,
        codeActions: false,
        codeLens: false,
        inlayHint: false,
        semanticHighlighting: true,
        onTypeFormatting: false,
        signatureHelp: false,
        documentHighlights: false,
        documentLink: false,
        documentSymbols: false,
        foldingRanges: false,
        selectionRanges: false,
        typeHierarchy: false
      }
    }
  },
  solargraph: {
    kind: 'external',
    label: 'Solargraph',
    languageIds: ['ruby'],
    defaultCommand: ['solargraph', 'stdio'],
    versionArgs: ['--version'],
    installCommand: 'gem install solargraph',
    updateCommand: 'gem update solargraph',
    initializationOptions: {
      diagnostics: false,
      completion: false,
      formatting: false,
      autoformat: false
    }
  },
  phpactor: {
    kind: 'external',
    label: 'Phpactor',
    languageIds: ['php'],
    defaultCommand: ['phpactor', 'language-server'],
    versionArgs: ['--version'],
    installCommand: PHPACTOR_PHAR_INSTALL_COMMAND,
    updateCommand: PHPACTOR_PHAR_INSTALL_COMMAND,
    installShells: ['posix'],
    // Why: set explicitly so a user-level phpactor.json cannot turn analysers back on for navigation.
    initializationOptions: {
      'language_server_phpstan.enabled': false,
      'language_server_psalm.enabled': false,
      'language_server_php_cs_fixer.enabled': false,
      'language_server_mago.enabled': false,
      'php_code_sniffer.enabled': false,
      'language_server.diagnostics_on_open': false,
      'language_server.diagnostics_on_update': false,
      'language_server.diagnostics_on_save': false,
      'language_server_worse_reflection.diagnostics.enable': false,
      // Why: replaces the defaults (first four), so they are repeated; var/cache holds Symfony duplicates.
      'indexer.exclude_patterns': [
        '/vendor/**/Tests/**/*',
        '/vendor/**/tests/**/*',
        '/vendor/composer/**/*',
        '/vendor/rector/rector/stubs-rector',
        '/var/cache/**/*',
        '/var/log/**/*',
        '/node_modules/**/*'
      ]
    }
  },
  intelephense: {
    kind: 'external',
    label: 'Intelephense',
    languageIds: ['php'],
    defaultCommand: ['intelephense', '--stdio'],
    // Why: `intelephense --version` does not exist; it starts the server and exits 1 without a client.
    versionArgs: null,
    installCommand: 'npm install -g intelephense',
    updateCommand: 'npm update -g intelephense',
    // Why: storage and licence stay at Intelephense's per-user defaults; never ship a licence key.
    initializationOptions: {},
    // Why: Intelephense reads its settings from workspace/configuration only, not initializationOptions.
    workspaceConfiguration: {
      intelephense: {
        diagnostics: { enable: false },
        telemetry: { enabled: false },
        // Why: replaces the defaults (first ten), so they are repeated; var/cache holds Symfony duplicates.
        files: {
          exclude: [
            '**/.git/**',
            '**/.svn/**',
            '**/.hg/**',
            '**/CVS/**',
            '**/.DS_Store/**',
            '**/node_modules/**',
            '**/bower_components/**',
            '**/vendor/**/{Tests,tests}/**',
            '**/.history/**',
            '**/vendor/**/vendor/**',
            '**/var/cache/**',
            '**/var/log/**'
          ]
        }
      }
    }
  }
}

export function enabledServerForLanguage(
  settings: RepoLanguageServerSettings | undefined,
  languageId: string
): LanguageServerId | null {
  for (const id of LANGUAGE_SERVER_IDS) {
    if (settings?.enabled?.[id] && LANGUAGE_SERVER_CATALOG[id].languageIds.includes(languageId)) {
      return id
    }
  }
  return null
}

export function workspaceConfigurationFor(id: LanguageServerId): Readonly<Record<string, unknown>> {
  const entry = LANGUAGE_SERVER_CATALOG[id]
  return entry.kind === 'external' ? (entry.workspaceConfiguration ?? {}) : {}
}
