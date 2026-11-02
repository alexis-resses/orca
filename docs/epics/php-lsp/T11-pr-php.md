# PR 1 — `feat/lsp-php` (à ouvrir par Alexis)

- **Branche** : `alexis-resses:feat/lsp-php` (6 commits, sans `docs/epics/`).
- **Base** : voir « Ouverture selon la réponse amont » dans `T11-amont.md` (fusion de #24703, accord de MTEKode, ou PR draft empilée sans réponse).
- **Avant ouverture** : ouvrir l'issue 1 de `T11-issues.md` et remplacer `#PHP_ISSUE` ; captures avant / après (Visual Proof) ; test Windows natif (Testing + case « manually tested ») ; handle X facultatif.
- **Si PR empilée sur #24703 (pas encore fusionnée)** : ouvrir en **draft** et ajouter en tête de description : `> Stacked on #24703: the first commits are that PR's. Please review only the 6 commits after 215cbee. I will rebase onto main once it merges.`

---

## ELI5

Orca's editor can now jump to definitions, list references and show hover docs in PHP projects, using Phpactor or Intelephense, the same way it already does for Ruby. You pick the server per project in Settings, and it only runs once you switch it on.

## What Changed

**Before:** Settings → project → Language Servers offered TypeScript and a hand-written Ruby picker. PHP files were never sent to any server, so F12 and hover did nothing across files.

**After:**

- **Settings.** One row per language, generated from the language-server catalog. Ruby behaves exactly as before; a new **PHP** row offers Off / Phpactor / Intelephense. Phpactor wins a tie, like `ruby-lsp` over `solargraph`.
- **Install / Update.** Intelephense: `npm install -g` / `npm update -g`. Phpactor: download of the release PHAR to `~/.local/bin/phpactor` through a temp file, so an interrupted update keeps the working binary. That command only makes sense in a POSIX shell, so under PowerShell or cmd the buttons are replaced by a hint to use Git Bash or WSL (new optional catalog field `installShells`).
- **Editor.** `php` models are synced with the server; F12, Shift+F12 and hover use it. Without a server, PHP returns nothing instead of falling back to the TypeScript worker, like Ruby.
- **Terminal.** Modifier-click on a PHP name, including namespaced ones like `App\Service\Mailer`, looks it up through `workspace/symbol`.

**Mechanism:**

- **Navigation-only options.** Phpactor gets its analysers and diagnostics off and `var/cache`, `var/log`, `node_modules` excluded from indexing; `vendor/` stays indexed so framework classes resolve.
- **`workspace/configuration`.** Intelephense ignores `initializationOptions` and reads its settings through `workspace/configuration`, which the router answered with `null`. With defaults, F12 in a Symfony project also landed in the generated `var/cache` copies (measured). The router now answers from per-server catalog values (`workspaceConfiguration`), section by section, including dotted sub-sections. Servers without that field still get `null`, so TypeScript and Ruby are unchanged.
- **Probe.** `intelephense --version` does not exist (it starts the server and exits 1 without a client). `versionArgs: null` means "being on PATH is the check"; the badge shows *Installed* without a version.

## Why

- **Two PHP servers, like Ruby.** Phpactor is MIT and only needs PHP 8.1+; Intelephense is faster and follows return types without docblocks, but is proprietary, so it is detected when installed and never bundled.
- **Generic settings rows** instead of copying the Ruby picker: the next language is a catalog entry, not another hand-written block.
- **Catalog-driven `workspace/configuration`** instead of a PHP special case in the router: the router stays generic and keeps answering `null` to everything else.
- **PHAR for Phpactor** instead of `composer global require`: no Composer needed, one self-contained file.

## Linked Issue

Fixes #PHP_ISSUE

Part of #5247 (cross-file go to definition). Builds on #24703 (Fixes #24702).

## Visual Proof

TODO (Alexis): before/after of the Language Servers section with the PHP row, and F12 / hover in a PHP file.

## Testing

- Unit tests: catalog (one server per language, overrides), settings rows (Ruby unchanged, PHP choice / switch / off, install command, PowerShell hint, Ruby keeps its button under PowerShell), install command per shell, router `workspace/configuration` (sections, sub-sections, unknown sections, prototype keys), probe without version flag, PHP document sync and providers, PHP symbol tokens and ranking.
- E2E (`tests/e2e/lsp-navigation-php.spec.ts`, electron-headless, `ORCA_BACKGROUND_LAUNCH=1`): enables Phpactor then Intelephense on a Composer/PSR-4 fixture and on a plain PHP fixture without Composer (`require_once`, global functions, `define`); F12 and hover asserted per server. Skips when the server is not on PATH. 7/7 green with the TypeScript e2e.
- Plain PHP, per server (headless):

| Case | Phpactor | Intelephense |
|---|---|---|
| Global function after `require_once` | resolved | resolved |
| `new Invoice` (no namespace) | resolved | resolved |
| `define` constant | resolved | resolved |
| Chained method with `@return` | resolved | resolved |
| Chained method without `@return` or type | not resolved | resolved |
| Dynamic call `$obj->$method()` | not resolved | not resolved |

- Real projects (headless, catalog options): `symfony/demo` with `vendor/` and WordPress; timings, memory and per-gesture results in the epic notes. Intelephense is the better default on both; Phpactor uses less memory at rest.
- Platforms: Linux (Ubuntu on WSL2), unit + e2e + manual check in the app. Windows: TODO (Alexis).
- `pnpm tc`, `check:code-quality:changed`, `check:max-lines-ratchet` and the localization checks pass. `lsp-session.test.ts`, `remote-snapshot-alt-screen-host-chain.test.ts` and some `src/main/ipc` pty tests are load-sensitive in the full parallel run and pass alone (same as noted in #24703).

- Full `pnpm lint`: clean on every file this PR touches. Two failures already exist at the base `215cbee` and are not from this PR: `anti-slop(no-object-parameters)` in `src/renderer/src/lib/lsp/lsp-navigation-providers.ts:27` (from #24703) and the focus-read ratchet in `src/renderer/src/lib/worktree-creation-ready-toast.tsx`. `pnpm build`: desktop build passes; the mobile web bundle was not built locally (mobile dependencies not installed), CI covers it.

- [ ] I manually tested these changes locally
- [x] Automated tests added/updated, or explained why not below

## AI Disclosure

Implemented with Claude Code (Claude Opus 5.5 orchestrating; Sonnet / Haiku / Opus subagents per task), from a written task plan, with a review gate per task (self-review, lightweight multi-agent preflight, then challenge of each finding).

## Review

Start with `src/shared/language-server-catalog.ts` (the PHP entries and why each option is there), then `src/main/lsp/lsp-message-router.ts` (`workspace/configuration`), then `src/renderer/src/components/settings/LanguageServerChoiceRow.tsx` (the generic row).

## Agent skill upstream boundary

- [x] Not applicable, or this change copies or mechanically translates no upstream skill-installer source, tests, fixtures, registry entries, path tables, comments, or documentation.

## Notes

- **Security:** nothing new spawns without the existing per-project opt-in; the probe no longer runs anything for Intelephense. The Phpactor PHAR has no published checksum or signature, so the download is trusted like `gem install` / `npm -g`. No Intelephense licence key is stored.
- **Known limits:** Phpactor exits neither on stdin EOF nor when its parent `processId` dies, so after an Orca crash (not a normal quit, which stops it cleanly) a Phpactor process can linger on native hosts; Intelephense exits on EOF. Phpactor can resolve a definition into a copy embedded in a PHAR under `vendor/` (seen with `EventSubscriberInterface` via `maker-bundle`'s `php-cs-fixer.phar`), which Orca cannot open. Dynamic calls are not resolved by either server; Intelephense has no server-side memory cap (`maxMemory` is a VS Code client setting; a custom command can pass `--max-old-space-size`); each worktree builds its own index (sharing one is unsafe: absolute paths, no writer lock). The exclusion lists repeat each server's defaults because they replace them.
- **Cross-platform / SSH:** remote hosts are unchanged (still no spawning). WSL repos are the follow-up PR.
- **Mobile / backwards compatibility:** no mobile or wire change; existing Ruby settings are read unchanged by the generic rows.
- **Localization:** one new optional string (`installNeedsPosixShell`) in the 6 locales.

## Author

X (Twitter): TODO (Alexis, optional)

## Checklist

- [x] This PR is small and focused
- [x] I explained what changed and why (ELI5, the user-facing before/after, the mechanism, and why over the alternatives)
- [ ] Before/after screenshots or videos attached for UI changes, or `N/A` with reason
- [x] Self-reviewed for correctness, security, and performance
- [x] Cross-platform, SSH/remote, and path/shortcut impact considered (or N/A)
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass (or CI will cover; local preferred) — see Testing: pre-existing base failures
