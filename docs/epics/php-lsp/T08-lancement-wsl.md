# T08 — Lancement et détection du serveur dans la distro WSL

## Objectif
Pour un repo WSL, résoudre la commande du serveur dans la distro, la détecter (`--version`) et la lancer en process long via `wsl.exe`, sans encore traduire les URI.

## Contexte
`resolveLspServerCommand` résout aujourd'hui un programme sur le PATH Windows ; `probeExternal` lance `--version` en local. Conception validée dans T06.

## À faire
1. Dans `lsp-server-command.ts`, si `parseWslUncPath(rootPath)` renvoie une distro : programme = `resolveWslExecutablePath()`, args = `buildWslExecArgs(distro, …)` lançant la commande du catalogue (ou l'override) avec le cwd Linux et le PATH de login décidés en T06. Renvoyer aussi `wsl: { distro, linuxRoot }` dans le résultat pour T09a.
2. Cwd Windows du spawn via `resolveWslInteropSpawnCwd` (pas de cwd UNC brut).
3. `lsp-probe.ts` : même résolution pour `--version` sur un repo WSL, via `wsl-runner` (stdout fencé, voir `buildWslCapturedLoginShellCommand`).
4. Arrêt : appliquer la stratégie de T06 (fermeture de stdin, puis kill) et la tester avec le faux serveur `__fixtures__/fake-language-server.mjs` si possible.
5. Tests : argv exact produit pour un repo WSL (avec et sans override), cwd, probe installé / manquant. Rien ne change pour un repo natif (tests existants inchangés).

## Fichiers à lire
- `docs/epics/php-lsp/T06-conception-wsl.md`
- `src/main/lsp/lsp-server-command.ts` et `.test.ts`
- `src/main/lsp/lsp-probe.ts` et `.test.ts`
- `src/main/wsl/wsl-runner.ts`, `src/main/wsl/wsl-executable-path.ts`, `src/shared/wsl-login-shell-command.ts`, `src/main/wsl-interop-spawn-directory.ts`

## Critères d'acceptation
- Sur le poste : Réglages d'un repo WSL → Phpactor affiché « installé » avec sa version quand il est installé dans la distro.
- Aucun `child_process` direct, aucun `wsl.exe --` (toujours `--exec`).

## Commit
`feat(lsp): resolve, probe and spawn language servers inside WSL distros`
