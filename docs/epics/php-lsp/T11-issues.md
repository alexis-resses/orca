# Issues amont à ouvrir avant les PR (par Alexis)

Le template de PR exige une vraie issue liée pour un contributeur externe (« Refs is not sufficient »), et #5247 (cross-file go to definition, tous langages) n'est pas entièrement réglée par la PR PHP. D'où une issue par PR, chacune reliée à #5247 et #24703.

Formulaire : **Feature request** (`.github/ISSUE_TEMPLATE/feature_request.yml`, titre préfixé `[Feature]: `, en anglais). Les numéros obtenus remplacent `#PHP_ISSUE` / `#WSL_ISSUE` dans `T11-pr-php.md` et `T11-pr-wsl.md`.

Ouvrables dès maintenant : une issue n'engage rien et ne dépend pas de la fusion de #24703.

---

## Issue 1 — PHP

**Title:** `[Feature]: Go to definition, references and hover for PHP files (Phpactor / Intelephense)`

**Problem or use case**

In a PHP project (Symfony, WordPress, plain PHP with `require_once`), F12, Shift+F12 and hover do nothing across files in Orca's editor: PHP files are never sent to a language server. #24703 adds external language servers for Ruby; PHP has no entry, so the only option is to switch to another editor to follow a class into `src/` or `vendor/`.

**Proposed solution**

Add PHP to the language-server catalog introduced by #24703, with two servers to choose from per project, like `ruby-lsp` / `solargraph`:

- **Phpactor** (MIT, PHP 8.1+), installed as the release PHAR;
- **Intelephense** (proprietary, detected when installed through npm, never bundled).

Off by default, navigation-only options (no diagnostics or analysers), `var/cache` and `var/log` excluded from indexing so Symfony's generated copies do not show up as definitions. Settings rows generated from the catalog instead of a second hand-written picker.

**Alternatives or additional context**

- Part of #5247; builds on #24703.
- Measured on `symfony/demo` (with `vendor/`) and WordPress: both servers resolve classes, functions and constants; Intelephense also follows return types without docblocks. A PR is ready.

---

## Issue 2 — WSL

**Title:** `[Feature]: Language servers for repositories inside WSL`

**Problem or use case**

On Windows, a repository opened from `\\wsl.localhost\<distro>\...` is treated as a local repository with a UNC path. Orca looks for the language server on the Windows PATH, so a server installed inside the distro (where PHP, Ruby and their tools usually live) is reported as not installed. Even a Windows-side server would index the project over the slow 9P share and would not understand Linux paths in `vendor/` or gems.

**Proposed solution**

For WSL repositories, run external language servers inside the repository's distro through `wsl.exe --exec`, from the repository's Linux directory with the distro's login PATH, and translate file URIs between the editor (`\\wsl.localhost\...`) and the server (`file:///home/...`). Status probe and Install / Update run inside the distro as well. The bundled TypeScript server and SSH repositories are unchanged.

**Alternatives or additional context**

- Part of #5247; builds on #24703 and the PHP issue above (works for Ruby too).
- Considered: a Windows-side server over UNC paths (slow, wrong toolchain), translating URIs in the message router (would touch its trust-boundary logic). A PR is ready, stacked on the PHP one.
