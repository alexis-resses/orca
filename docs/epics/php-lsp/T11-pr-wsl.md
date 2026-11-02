# PR 2 — `feat/lsp-wsl` (à ouvrir par Alexis, après la PR 1)

- **Branche** : `alexis-resses:feat/lsp-wsl` (4 commits au-dessus de `feat/lsp-php`, sans `docs/epics/`). Base `stablyai/orca:main`.
- **Prérequis** : validation manuelle Windows → WSL (check-list en bas de `T09b-reglages-wsl.md`) ; sans elle, cette PR reste en draft.
- **Avant de coller** : ouvrir l'issue WSL (`T11-issues.md`) et remplacer `#WSL_ISSUE` ; remplacer `#PHP_PR` par le numéro de la PR 1 et chaque `[ADD: …]` ; tant que la PR 1 n'est pas fusionnée, ouvrir en **draft** et garder le bloc « Stacked on », sinon le supprimer.
- Tout ce qui suit la ligne `---` se colle tel quel.

---

**Title:** `feat(lsp): run language servers inside WSL for WSL repositories`

> **Stacked on #PHP_PR** (itself on #24703). Please review only the last 4 commits. I will rebase onto `main` once those merge.

## ELI5

On Windows, projects that live inside WSL (`\\wsl.localhost\Ubuntu\...`) can now use language servers installed inside the distro. Go to definition, references and hover work across files for them, the same as for projects on the Windows disk.

## What Changed

**Before:** a WSL repository is a local repository with a UNC path, so Orca looked for the server on the Windows PATH, did not find the one installed in the distro, and reported it as not installed. Even a Windows-side server would have read UNC paths over the slow 9P share.

**After:**

- **Launch.** For a WSL repository, external servers run inside the repository's distro through `wsl.exe --exec`, from the repository's Linux directory, with the distro's login PATH (so nvm and `~/.local/bin` installs are found). The bundled TypeScript server keeps running on Windows.
- **Paths.** The server sees `file:///home/...`; the editor keeps `\\wsl.localhost\<distro>\...`. URIs are translated both ways, so F12 into another file or into `vendor/` opens the right Orca tab.
- **Status and install.** The presence check runs inside the distro. Install / Update open the inline terminal in that distro, in the repository's Linux directory, even when the Windows default shell is PowerShell.

**Mechanism:**

- `wsl-runner.ts` exposes the spawn preparation it already did for one-shot commands (`buildWslSpawnCommand`), so the long-lived server reuses the same argv, cached login PATH and Windows cwd instead of a copy.
- The Linux working directory goes through the existing `sh -c 'cd "$1" || exit 1; …'` wrapper rather than `wsl.exe --cd`: with `--cd`, a missing directory silently starts in `/` with exit code 0, and the server would index the whole distro.
- A pure module (`lsp-wsl-uri-mapper.ts`) rewrites URI fields by key (`uri` and `rootUri` towards the server; `uri`, `targetUri` and `scopeUri` back). It keeps the repository's share name (`wsl.localhost` or `wsl$`) and distro casing, so a file maps to the same Monaco model. Linux paths under `/mnt/<drive>` outside the repository map back to drive paths.
- The mapper sits at `LspSession`'s I/O boundary, not in the router: the router only ever sees editor URIs, so `initialize`, the `didClose` sent on detach and `workspace/workspaceFolders` replies are covered without changing it.
- `processId` is `null` for WSL sessions: the Windows PID does not exist inside the distro, and servers that watch their parent would exit.
- Stopping needs nothing new: killing `wsl.exe` kills the Linux process (verified), and stdin EOF also reaches it if Orca dies.

## Why

- **Run in the distro** rather than a Windows server over UNC paths: PHP, Ruby and their tools live in WSL, and indexing over 9P is slow.
- **Translate at the session boundary** rather than in the router: one place, and the router's trust-boundary logic stays untouched.
- **Reuse `wsl-runner`** rather than a new WSL spawn path: same PATH cache, same budget, same guards (`assertNotShellString`, `assertGuestPath`).

## Linked Issue

Fixes #WSL_ISSUE

Part of #5247. Builds on #PHP_PR and #24703.

## Visual Proof

[ADD: video of F12 from a Symfony controller in a WSL repository into a `vendor/` class, opening as a `\\wsl.localhost\...` tab; screenshot of the Language Servers section showing the server as installed in the distro.]

## Testing

- **Unit tests:** URI mapper (every field and direction, `wsl$` and `wsl.localhost`, distro casing, DrvFs inside and outside the root, encoded characters, query and fragment, non-`file:` URIs, round trips; 56 tests); command resolution and presence check for WSL repositories (argv with and without a command override, cwd, missing login PATH, `versionArgs: null` through `command -v`); install command and terminal for WSL repositories.
- **Session test against a real child process:** a WSL-shaped session sends Linux URIs to the server (`initialize`, `didOpen`, `didClose` on detach, `workspaceFolders` reply) and returns UNC URIs (definition, references, `workspace/symbol`), spawns from the resolved cwd and sends `processId: null`. Native sessions are asserted unchanged.
- **Manual, through `wsl.exe` from inside the distro:** the generated argv starts Phpactor and finds Intelephense on the login PATH; killing `wsl.exe` kills the Linux process.
- **Platforms:** Linux (Ubuntu on WSL2) for unit tests. Windows → WSL in the app: [ADD: what you tested, e.g. F12 / references / hover with Phpactor and Intelephense, install from PowerShell default shell].
- **Checks:** `pnpm typecheck`, `check:code-quality:changed`, `check:max-lines-ratchet` and the localization checks pass. Full `pnpm lint` is clean on every file this PR touches; the two failures already present at the base are listed in #PHP_PR.

- [ ] I manually tested these changes locally
- [x] Automated tests added/updated, or explained why not below

## AI Disclosure

Implemented with Claude Code (Claude Opus 5.5 orchestrating, with Sonnet, Haiku and Opus subagents per task), from a written task plan and a design spike, with a review gate after each task. I reviewed and tested the result.

## Review

Start with `src/main/lsp/lsp-wsl-uri-mapper.ts`, then `src/main/lsp/lsp-session.ts` (where it is applied), then `src/main/lsp/lsp-server-command.ts` and `src/main/wsl/wsl-runner.ts` (launch).

AI review summary:

- **Cross-platform:** the WSL branch only applies to `\\wsl.localhost\` / `\\wsl$\` roots, which only exist on Windows; macOS, Linux and native Windows repositories take the unchanged path.
- **SSH / remote:** unchanged.
- **Agents and integrations:** not affected.
- **Performance:** the server indexes the Linux filesystem directly instead of going over 9P; URI mapping is a per-message key rewrite.
- **UI:** no new UI; the existing install terminal gets a cwd and shell for WSL repositories.
- **Security:** see Notes.

## Agent skill upstream boundary

- [x] Not applicable, or this change copies or mechanically translates no upstream skill-installer source, tests, fixtures, registry entries, path tables, comments, or documentation.

## Notes

- **Security:** argv and cwd reach the distro as positional arguments of a fixed wrapper, never interpolated into a script; the existing `wsl-runner` guards apply.
- **Known limits:** `file:///home/...` links inside hover Markdown are not translated; a command override on a WSL repository is not checked before spawning (a missing binary shows up as an immediate exit, then the usual crash budget applies).
- **Native and SSH repositories:** unchanged.
- **Mobile / backwards compatibility:** no mobile or wire change; WSL repositories with no server enabled behave as before.

## Author

X (Twitter): [ADD: your handle, or remove this section]

## Checklist

- [x] This PR is small and focused
- [x] I explained what changed and why (ELI5, the user-facing before/after, the mechanism, and why over the alternatives)
- [ ] Before/after screenshots or videos attached for UI changes, or `N/A` with reason
- [x] Self-reviewed for correctness, security, and performance
- [x] Cross-platform, SSH/remote, and path/shortcut impact considered (or N/A)
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass (or CI will cover; local preferred) — see Testing
