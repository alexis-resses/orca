# PR 2 — `feat/lsp-wsl` (à ouvrir par Alexis, après la PR 1)

- **Branche** : `alexis-resses:feat/lsp-wsl` (4 commits au-dessus de `feat/lsp-php`, sans `docs/epics/`).
- **Base** : `stablyai/orca:main`, après la PR 1 ; ouverte avant sa fusion = PR empilée (voir ci-dessous).
- **Avant ouverture** : ouvrir l'issue 2 de `T11-issues.md` et remplacer `#WSL_ISSUE` ; captures ; surtout la validation manuelle Windows → WSL (check-list en bas de `T09b-reglages-wsl.md`), sans laquelle cette PR reste en draft.
- **Base GitHub** : une PR ne peut cibler qu'une branche du dépôt amont ; tant que la PR 1 n'est pas fusionnée, ouvrir en **draft** vers `main` avec en tête : `> Stacked on #PHP_PR (itself on #24703). Please review only the last 4 commits.`

---

## ELI5

On Windows, projects that live inside WSL (`\\wsl.localhost\Ubuntu\...`) can now use language servers installed inside the distro. Go to definition, references and hover work across files for them, the same as for projects on the Windows disk.

## What Changed

**Before:** a WSL repo is a local repo with a UNC path, so Orca looked for the server on the Windows PATH, did not find the one installed in the distro, and showed it as not installed. Even a Windows-side server would have read UNC paths over the slow 9P share.

**After:**

- **Launch.** For a WSL repo, external servers run inside the repo's distro through `wsl.exe --exec`, from the repo's Linux directory, with the distro's login PATH (so nvm and `~/.local/bin` installs are found). The bundled TypeScript server keeps running on Windows.
- **Paths.** The server sees `file:///home/...`; the editor keeps `\\wsl.localhost\<distro>\...`. URIs are translated both ways, so F12 into another file or into `vendor/` opens the right Orca tab.
- **Status and install.** The probe runs inside the distro. Install / Update open the inline terminal in that distro, in the repo's Linux directory, even when the Windows default shell is PowerShell.

**Mechanism:**

- `wsl-runner.ts` exposes the spawn preparation it already did for one-shot commands (`buildWslSpawnCommand`), so the long-lived server reuses the same argv, cached login PATH and Windows cwd instead of a copy.
- The guest cwd goes through the existing `sh -c 'cd "$1" || exit 1; …'` wrapper rather than `wsl.exe --cd`: `--cd` on a missing directory silently starts in `/` with exit code 0, and the server would index the whole distro.
- A pure module (`lsp-wsl-uri-mapper.ts`) rewrites URI fields by key (`uri`, `rootUri` towards the server; `uri`, `targetUri`, `scopeUri` back), keeping the repo's share (`wsl.localhost` / `wsl$`) and distro casing so a file maps to the same Monaco model. Linux paths under `/mnt/<drive>` outside the repo map back to drive paths.
- The mapper sits at `LspSession`'s I/O boundary, not in the router: the router only ever sees editor URIs, so `initialize`, detach-time `didClose` and `workspace/workspaceFolders` replies are covered without changing it.
- `processId` is `null` for WSL sessions: the Windows pid does not exist inside the distro, and servers that watch their parent would exit.
- Stopping needs nothing new: killing `wsl.exe` kills the Linux process (verified), and stdin EOF also reaches it if Orca dies.

## Why

- **Run in the distro** rather than a Windows server over UNC: PHP and its tools live in WSL, and indexing over 9P is slow.
- **Translate at the session boundary** rather than in the router: one place, and the router's trust-boundary logic is untouched.
- **Reuse `wsl-runner`** rather than a new WSL spawn path: same PATH cache, same budget, same guards (`assertNotShellString`, `assertGuestPath`).

## Linked Issue

Fixes #WSL_ISSUE

Part of #5247. Builds on #PHP_PR and #24703.

## Visual Proof

TODO (Alexis): F12 from a Symfony controller in a WSL repo into a `vendor/` class, opened as a UNC tab.

## Testing

- Unit tests: URI mapper (every field and direction, `wsl$` and `wsl.localhost`, distro casing, DrvFs inside and outside the root, encoded characters, query/fragment, non-`file:` URIs, round trips; 56 tests), command resolution and probe for WSL repos (argv with and without override, cwd, missing login PATH, `versionArgs: null` via `command -v`), install command and terminal for WSL repos.
- Session test against a real child process: a WSL-shaped session sends Linux URIs to the server (initialize, didOpen, didClose on detach, workspaceFolders reply) and returns UNC URIs (definition, references, workspace/symbol), spawns from the resolved cwd and sends `processId: null`; native sessions are asserted unchanged.
- Manual, through `wsl.exe` from the distro: the produced argv starts Phpactor (`Phpactor 2026.10.07.0`) and finds Intelephense on the login PATH; killing `wsl.exe` kills the guest process.
- Platforms: Linux (Ubuntu on WSL2) for unit tests. Windows → WSL in the app: TODO (Alexis).

- Full `pnpm lint`: clean on every file this PR touches. Two failures already exist at the base `215cbee` and are not from this PR: `anti-slop(no-object-parameters)` in `src/renderer/src/lib/lsp/lsp-navigation-providers.ts:27` (from #24703) and the focus-read ratchet in `src/renderer/src/lib/worktree-creation-ready-toast.tsx`. `pnpm build`: desktop build passes; the mobile web bundle was not built locally (mobile dependencies not installed), CI covers it.

- [ ] I manually tested these changes locally
- [x] Automated tests added/updated, or explained why not below

## AI Disclosure

Implemented with Claude Code (Claude Opus 5.5 orchestrating; Sonnet / Haiku / Opus subagents per task), from a written task plan and a design spike, with a review gate per task.

## Review

Start with `src/main/lsp/lsp-wsl-uri-mapper.ts`, then `src/main/lsp/lsp-session.ts` (where it is applied), then `src/main/lsp/lsp-server-command.ts` and `src/main/wsl/wsl-runner.ts` (launch).

## Agent skill upstream boundary

- [x] Not applicable, or this change copies or mechanically translates no upstream skill-installer source, tests, fixtures, registry entries, path tables, comments, or documentation.

## Notes

- **Security:** argv and cwd reach the guest as positional arguments of a fixed wrapper, never interpolated; existing `wsl-runner` guards apply.
- **Known limits:** `file:///home/...` links inside hover Markdown are not translated; a command override on a WSL repo is not checked for presence before spawn (a missing binary shows up as an immediate exit, then the usual crash budget).
- **Native and SSH repos:** unchanged.
- **Mobile / backwards compatibility:** no mobile or wire change; WSL repos that had no server enabled behave as before.

## Author

X (Twitter): TODO (Alexis, optional)

## Checklist

- [x] This PR is small and focused
- [x] I explained what changed and why (ELI5, the user-facing before/after, the mechanism, and why over the alternatives)
- [ ] Before/after screenshots or videos attached for UI changes, or `N/A` with reason
- [x] Self-reviewed for correctness, security, and performance
- [x] Cross-platform, SSH/remote, and path/shortcut impact considered (or N/A)
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass (or CI will cover; local preferred) — see Testing: pre-existing base failures
