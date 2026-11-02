# PR 1 — `feat/lsp-php` (à ouvrir par Alexis)

- **Branche** : `alexis-resses:feat/lsp-php` (6 commits, sans `docs/epics/`). Base `stablyai/orca:main`.
- **Ouverture** : voir « Ouverture selon la réponse amont » dans `T11-amont.md`.
- **Avant de coller** : ouvrir l'issue PHP (`T11-issues.md`) et remplacer `#PHP_ISSUE` ; remplacer chaque `[ADD: …]` ; si #24703 n'est pas fusionnée, ouvrir en **draft** et garder le bloc « Stacked on », sinon le supprimer.
- Tout ce qui suit la ligne `---` se colle tel quel (titre dans le champ titre, le reste dans la description).

---

**Title:** `feat(lsp): add PHP navigation with Phpactor and Intelephense`

> **Stacked on #24703.** The first commits are that PR's; please review only the 6 commits after `215cbee`. I will rebase onto `main` once #24703 merges and mark this ready then.

## ELI5

Orca's editor can now jump to a definition, list references and show hover docs in PHP projects, using Phpactor or Intelephense, the same way #24703 does for Ruby. You pick the server per project in Settings, and nothing runs until you turn it on.

## What Changed

**Before:** Settings → project → Language Servers offered TypeScript and a hand-written Ruby picker. PHP files were never sent to a language server, so F12, Shift+F12 and hover did nothing across files.

**After:**

- **Settings.** One row per language, generated from the language-server catalog. Ruby looks and behaves exactly as before; a new **PHP** row offers Off / Phpactor / Intelephense. If both are somehow enabled, Phpactor wins, like `ruby-lsp` over `solargraph`.
- **Install / Update.** Intelephense uses `npm install -g` / `npm update -g`. Phpactor downloads the release PHAR to `~/.local/bin/phpactor` through a temporary file, so an interrupted update leaves the working binary in place. That command needs a POSIX shell, so under PowerShell or cmd the buttons are replaced by a hint to use Git Bash or WSL (new optional catalog field `installShells`).
- **Editor.** PHP models are synced with the server, and F12, Shift+F12 and hover go through it. Without a server, PHP returns nothing instead of falling back to the TypeScript worker, like Ruby.
- **Terminal.** Modifier-click on a PHP name, including namespaced names such as `App\Service\Mailer`, looks it up through `workspace/symbol`.

**Mechanism:**

- **Navigation-only options.** Phpactor starts with its analysers and diagnostics off and with `var/cache`, `var/log` and `node_modules` excluded from indexing. `vendor/` stays indexed so framework classes resolve.
- **`workspace/configuration`.** Intelephense ignores `initializationOptions` and reads its settings through `workspace/configuration`, which the router answered with `null`. On its defaults, F12 in a Symfony project also landed in the generated copies under `var/cache` (measured). The router now answers from per-server catalog values (`workspaceConfiguration`), section by section, including dotted sub-sections. Servers without that field still get `null`, so TypeScript and Ruby are unchanged.
- **Presence check.** `intelephense --version` does not exist: it starts the server, which exits with code 1 without a client. `versionArgs: null` means "found on PATH is the check", and the badge shows *Installed* without a version.

## Why

- **Two PHP servers, like Ruby.** Phpactor is MIT-licensed and only needs PHP 8.1+. Intelephense is faster and follows return types without docblocks, but it is proprietary, so Orca detects it when installed and never bundles it.
- **Generic settings rows** instead of a copy of the Ruby picker: the next language becomes a catalog entry, not another hand-written block.
- **Catalog-driven `workspace/configuration`** instead of a PHP special case in the router: the router stays generic and keeps answering `null` to everything else.
- **A PHAR for Phpactor** instead of `composer global require`: no Composer needed, one self-contained file.

## Linked Issue

Fixes #PHP_ISSUE

Part of #5247 (cross-file go to definition). Builds on #24703 (which fixes #24702).

## Visual Proof

[ADD: before/after of Settings → Language Servers with the new PHP row, and a short video of F12 + hover in a PHP file.]

## Testing

- **Unit tests:** catalog (one server per language, overrides); settings rows (Ruby unchanged, PHP choose / switch / off, install command, PowerShell hint, Ruby keeps its button under PowerShell); install command per shell; router `workspace/configuration` (sections, sub-sections, unknown sections, prototype keys); presence check without a version flag; PHP document sync and providers; PHP symbol tokens and ranking.
- **E2E** (`tests/e2e/lsp-navigation-php.spec.ts`, electron-headless, `ORCA_BACKGROUND_LAUNCH=1`): enables Phpactor, then Intelephense, on a Composer/PSR-4 fixture and on a plain PHP fixture without Composer (`require_once`, global functions, `define`), and asserts F12 and hover for each server. Skips when the server is not on PATH. 7/7 pass, together with the existing TypeScript e2e.
- **Plain PHP, per server:**

| Case | Phpactor | Intelephense |
|---|---|---|
| Global function after `require_once` | resolved | resolved |
| `new Invoice` (no namespace) | resolved | resolved |
| `define` constant | resolved | resolved |
| Chained method with `@return` | resolved | resolved |
| Chained method without `@return` or return type | not resolved | resolved |
| Dynamic call `$obj->$method()` | not resolved | not resolved |

- **Real projects** with the catalog options: `symfony/demo` (with `vendor/`) and WordPress. Intelephense is the better default on both; Phpactor uses less memory at rest.
- **Platforms:** Linux (Ubuntu on WSL2): unit, e2e, and a manual check in the app. Windows: [ADD: what you tested on Windows, or remove this line].
- **Checks:** `pnpm typecheck`, `check:code-quality:changed`, `check:max-lines-ratchet` and the localization checks pass. Full `pnpm lint` is clean on every file this PR touches; two failures already exist at the base `215cbee` and do not come from this PR: `anti-slop(no-object-parameters)` in `src/renderer/src/lib/lsp/lsp-navigation-providers.ts:27` (from #24703) and the focus-read ratchet in `src/renderer/src/lib/worktree-creation-ready-toast.tsx`. `pnpm build`: the desktop build passes; I did not build the mobile web bundle locally.
- `lsp-session.test.ts`, `remote-snapshot-alt-screen-host-chain.test.ts` and some `src/main/ipc` PTY tests are timing-sensitive in the full parallel run and pass on their own (same as noted in #24703).

- [ ] I manually tested these changes locally
- [x] Automated tests added/updated, or explained why not below

## AI Disclosure

Implemented with Claude Code (Claude Opus 5.5 orchestrating, with Sonnet, Haiku and Opus subagents per task), from a written task plan, with a review gate after each task: self-review, a lightweight multi-agent check, then a challenge of each finding. I reviewed and tested the result.

## Review

Start with `src/shared/language-server-catalog.ts` (the PHP entries and why each option is there), then `src/main/lsp/lsp-message-router.ts` (`workspace/configuration`), then `src/renderer/src/components/settings/LanguageServerChoiceRow.tsx` (the generic row).

AI review summary:

- **Cross-platform:** the Phpactor install needs a POSIX shell and says so under PowerShell / cmd; paths go through Node path utilities; no shortcut changes.
- **SSH / remote:** unchanged; remote repos still spawn nothing.
- **Agents and integrations:** not affected.
- **Performance:** nothing starts until the project opts in; the presence check no longer runs anything for Intelephense; indexing excludes generated and dependency test folders.
- **UI:** the generic row reuses the existing Ruby layout and shadcn primitives; no new tokens.
- **Security:** see Notes.

## Agent skill upstream boundary

- [x] Not applicable, or this change copies or mechanically translates no upstream skill-installer source, tests, fixtures, registry entries, path tables, comments, or documentation.

## Notes

- **Security:** nothing new spawns without the existing per-project opt-in. The Phpactor PHAR has no published checksum or signature, so the download is trusted the same way as `gem install` or `npm -g`. No Intelephense licence key is stored.
- **Known limits:**
  - Phpactor exits neither on stdin EOF nor when its parent `processId` dies, so after an Orca crash (not a normal quit, which stops it cleanly) a Phpactor process can linger. Intelephense exits on EOF.
  - Phpactor can resolve a definition into a copy embedded in a PHAR under `vendor/` (seen with `EventSubscriberInterface` through `maker-bundle`'s `php-cs-fixer.phar`), which Orca cannot open.
  - Neither server resolves dynamic calls.
  - Intelephense has no server-side memory cap (`maxMemory` is a VS Code client setting); a custom command can pass `--max-old-space-size`.
  - Each worktree builds its own index; sharing one is unsafe (absolute paths, no writer lock).
  - The exclusion lists repeat each server's defaults because setting them replaces the defaults.
- **Cross-platform / SSH:** remote hosts are unchanged. WSL repositories are the follow-up PR.
- **Mobile / backwards compatibility:** no mobile or wire change; existing Ruby settings are read unchanged by the generic rows.
- **Localization:** one new string (`installNeedsPosixShell`) in the 6 locales.

## Author

X (Twitter): [ADD: your handle, or remove this section]

## Checklist

- [x] This PR is small and focused
- [x] I explained what changed and why (ELI5, the user-facing before/after, the mechanism, and why over the alternatives)
- [ ] Before/after screenshots or videos attached for UI changes, or `N/A` with reason
- [x] Self-reviewed for correctness, security, and performance
- [x] Cross-platform, SSH/remote, and path/shortcut impact considered (or N/A)
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass (or CI will cover; local preferred) — see Testing for two failures already present at the base
