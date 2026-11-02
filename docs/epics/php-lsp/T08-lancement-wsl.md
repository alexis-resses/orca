# T08 — Lancement et détection du serveur dans la distro WSL

## Objectif
Pour un repo WSL, résoudre la commande du serveur dans la distro, la détecter (`--version`) et la lancer en process long via `wsl.exe`, sans encore traduire les URI.

## Contexte
`resolveLspServerCommand` résout aujourd'hui un programme sur le PATH Windows ; `probeExternal` lance `--version` en local. Conception validée dans T06.

## À faire
1. `wsl-runner.ts` : exporter un constructeur de spawn (ex. `buildWslSpawnCommand(spec: WslSpec): Promise<{ program; args; cwd; env; environmentResolved }>`) bâti sur `getWslGuestEnvironment`, `buildGuestArgv` (donc `withGuestCwd`) et `buildHostEnv`, et l'utiliser dans `runWslProcess`. Ne pas recopier ces fonctions privées.
2. Dans `lsp-server-command.ts`, **serveurs `external` seulement** (le TypeScript intégré reste côté Windows), si `parseWslUncPath(rootPath)` renvoie une distro : commande = ce constructeur avec `{ distro, program: name, args, cwd: linuxRoot, loginPath: 'preferred' }`. Forme attendue (T06 §3.1) : `wsl.exe -d <distro> --exec sh -c 'cd "$1" || exit 1; shift; exec "$@"' orca-wsl <linuxRoot> <env> PATH=… HOME=… <programme> <args>`. Pas de `--cd` (retombe en silence sur `/`).
3. Types : `ResolvedLspCommand` gagne `cwd?: string` (cwd Windows = `resolveWslInteropSpawnCwd()`, jamais l'UNC) et `ResolvedLspServer` gagne `wsl?: { distro: string; linuxRoot: string }` pour T09a.
4. `lsp-probe.ts` : pour un repo WSL, `runWslProcess({ distro, program, args: [...args, ...versionArgs], cwd: linuxRoot, loginPath: 'preferred', timeoutMs: 10_000, maxOutputBytes: 64 * 1024 })`. Pas de fence à ajouter (déjà dans la sonde du login PATH). Code 0 → `installed`, sinon `missing`.
5. Arrêt : **rien à coder** (T06 §3.2 : tuer `wsl.exe` tue le serveur, l'EOF de stdin traverse `wsl.exe`). Vérifier par un test que `dispose` d'une session WSL suit le chemin natif.
6. Tests : argv exact pour un repo WSL (avec et sans override), cwd Windows, PATH absent (sonde échouée), probe installé / manquant, TypeScript intégré inchangé sur un repo WSL. Rien ne change pour un repo natif (tests existants inchangés).

## Fichiers à lire
- `docs/epics/php-lsp/T06-conception-wsl.md`
- `src/main/lsp/lsp-server-command.ts` et `.test.ts`
- `src/main/lsp/lsp-probe.ts` et `.test.ts`
- `src/main/wsl/wsl-runner.ts` et son test, `src/main/wsl/wsl-guest-environment.ts` (signature), `src/main/wsl/wsl-executable-path.ts`, `src/shared/wsl-login-shell-command.ts`, `src/main/wsl-interop-spawn-directory.ts`

## Critères d'acceptation
- Sur le poste : Réglages d'un repo WSL → Phpactor affiché « installé » avec sa version quand il est installé dans la distro.
- Aucun `child_process` direct, aucun `wsl.exe --` (toujours `--exec`).

## Commit
`feat(lsp): resolve, probe and spawn language servers inside WSL distros`
