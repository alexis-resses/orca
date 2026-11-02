# T06 — Spike : comportement actuel d'un repo WSL et conception

## Objectif
Confirmer ce qui se passe aujourd'hui quand on active un serveur sur un repo WSL, et figer la conception de T07–T09b. **Aucun code produit dans cette tâche**, seulement un document.

## Contexte
Le code LSP ne mentionne jamais WSL. Hypothèse : un repo WSL est `local` avec un chemin UNC, donc Orca lance le binaire Windows avec un cwd UNC. La PR #24703 annonce pourtant `unsupported-host` pour WSL.

## À faire
1. Vérifier dans le code comment un repo WSL est représenté (`Repo.path`, `executionHostId`, `parseWslUncPath`) et ce que renvoient `probeRepoLanguageServers` et `LspSessionManager.acquire` pour lui.
2. Le constater à la main : repo PHP dans WSL, activer Phpactor, noter le statut affiché et les logs.
3. Concevoir, en s'appuyant sur l'existant (lire sans modifier) :
   - **Lancement** : `wsl.exe` résolu par `resolveWslExecutablePath`, argv par `buildWslExecArgs(distro, [...])`, cwd Windows par `resolveWslInteropSpawnCwd`, cwd Linux par le serveur (`--cd` ou `sh -c 'cd … && exec …'` : choisir et justifier). PATH de login nécessaire (npm global, `~/.local/bin`) : voir `WslLoginPath` dans `wsl-runner.ts`.
   - **Arrêt** : tuer `wsl.exe` tue-t-il le serveur Linux ? Sinon, prévoir la fermeture de stdin (le serveur sort sur EOF) et le vérifier.
   - **URI** : liste exhaustive des champs à traduire dans chaque sens (initialize `rootUri`/`workspaceFolders`, `textDocument.uri`, réponses `Location`/`LocationLink` `uri`/`targetUri`, `workspace/symbol` `location.uri`, réponse à `workspace/configuration` / `workspace/workspaceFolders`). Forme exacte des URI Monaco pour un fichier WSL (`file://wsl.localhost/<distro>/...` ?).
   - **Probe / install** : détection via `wsl.exe --exec` ; install dans un terminal WSL (le builder renvoie déjà la commande brute pour un shell WSL).
4. Écrire la conception dans `docs/epics/php-lsp/T06-conception-wsl.md` et ajuster si besoin T07–T09b (fichiers, signatures).

## Fichiers à lire
- `src/main/lsp/lsp-session-manager.ts`, `lsp-probe.ts`, `lsp-session.ts`, `lsp-server-command.ts`
- `src/shared/wsl-paths.ts`, `src/shared/wsl-login-shell-command.ts`, `src/shared/execution-host.ts` (début)
- `src/main/wsl/wsl-runner.ts` (types et en-tête), `src/main/wsl/wsl-orcad-host-transport.ts`, `src/main/wsl/wsl-executable-path.ts`
- `src/renderer/src/lib/lsp/lsp-document-sync.ts` (construction des URI des modèles)

## Critères d'acceptation
- Comportement actuel constaté et décrit.
- `T06-conception-wsl.md` répond à chaque point du §3 avec les fonctions existantes à réutiliser.

## Commit
`docs(lsp): WSL language server design`

## Notes de sortie

- Conception dans `T06-conception-wsl.md`. Comportement actuel **déduit du code, non constaté dans l'UI** (Orca pas lancé sous Windows) : repo WSL = `local`, probe `missing` (pas `unsupported-host`), acquire `unavailable`, aucun process. À confirmer à la main par Alexis.
- Expériences réelles via `wsl.exe` : tuer `wsl.exe` tue le serveur Linux, l'EOF de stdin traverse, `--cd` sur un dossier absent démarre en `/` avec le code 0 (d'où le wrapper `sh -c 'cd "$1" || exit 1; …'` de `wsl-runner`), nvm n'est visible qu'en `bash -ilc` (d'où le login PATH en cache).
- Écarts au plan : traduction à la frontière d'E/S de `LspSession`, **routeur inchangé** ; `processId: null` pour WSL ; T08 exporte un constructeur de spawn depuis `wsl-runner.ts` et n'a pas de stratégie d'arrêt à coder. T07, T08, T09a, T09b ajustés en conséquence.
- Hors WSL, bloquant : `php` absent de `LSP_LANGUAGE_IDS` (`lsp-document-sync.ts:4`), aucune tâche ne le prévoit. Poste : `composer` absent de la distro (install Phpactor à revoir en T03/T10).
