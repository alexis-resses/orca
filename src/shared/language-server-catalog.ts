import { LANGUAGE_SERVER_IDS } from './language-server-types'
import type { AgentStartupShell } from './tui-agent-startup-shell'
import type { LanguageServerId, RepoLanguageServerSettings } from './language-server-types'

type CatalogEntryBase = { label: string; languageIds: readonly string[] }
export type BundledLanguageServer = CatalogEntryBase & { kind: 'bundled' }
export type ExternalLanguageServer = CatalogEntryBase & {
  kind: 'external'
  defaultCommand: readonly string[]
  versionArgs: readonly string[]
  installCommand: string
  updateCommand: string
  initializationOptions: unknown
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
    initializationOptions: {}
  },
  intelephense: {
    kind: 'external',
    label: 'Intelephense',
    languageIds: ['php'],
    defaultCommand: ['intelephense', '--stdio'],
    versionArgs: ['--version'],
    installCommand: 'npm install -g intelephense',
    updateCommand: 'npm update -g intelephense',
    initializationOptions: {}
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
