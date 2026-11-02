# T09a — Branchement session + routeur pour les repos WSL

## Objectif
La session utilise la commande de T08 et le routeur applique le mapper de T07 : navigation fonctionnelle côté main pour un repo WSL.

## Contexte
`LspSession` construit `rootUri` depuis `rootPath` et passe `workspaceFolders` au routeur ; le routeur relaie les messages entre ports et serveur. Notes de sortie de T07 et T08 à lire en premier.

## À faire
1. `lsp-session-manager.ts` : transmettre `resolved.wsl` à `createSession` (`LspSessionConfig` gagne `wsl?`).
2. `lsp-session.ts` : spawn avec `cwd: config.command.cwd ?? config.rootPath` ; si `config.wsl`, créer le mapper (`createWslUriMapper(rootPath)`), appliquer `toServer` dans l'écrivain passé au routeur et `toClient` dans `onServerMessage` **avant** `router.fromServer`. `rootUri` / `workspaceFolders` restent construits en UNC : l'écrivain les traduit. `processId: null` dans `initialize` pour une session WSL (le PID Windows n'existe pas dans la distro).
3. `lsp-message-router.ts` : **inchangé** (il ne voit que des URI client, T06 §3.3).
4. Hover : si le contenu Markdown contient des liens `file:///home/...`, les laisser (hors périmètre) mais le noter.
5. Tests de session avec le faux serveur et un spawn factice : aller-retour definition / references / workspace/symbol, `initialize` (`rootUri`, `workspaceFolders`, `processId`), réponse `workspace/workspaceFolders`, `didClose` de `detachPort` traduits. Session native inchangée.

## Fichiers à lire
- Notes de sortie de T07 et T08
- `src/main/lsp/lsp-session.ts` et `.test.ts`
- `src/main/lsp/lsp-session-manager.ts` et `.test.ts`
- `src/main/lsp/lsp-message-router.ts` (lecture seule)
- `docs/epics/php-lsp/T06-conception-wsl.md` §3.3
- `src/main/lsp/lsp-wsl-uri-mapper.ts`

## Critères d'acceptation
- Tests verts, tests existants inchangés.
- Aucun changement UI dans cette tâche.

## Commit
`feat(lsp): route WSL language server sessions through the URI mapper`

## Notes de sortie

- Fait : `LspSession` crée le mapper seulement si `config.wsl` (TypeScript intégré sur UNC reste non traduit), applique `toServer` dans l'écrivain du routeur et `toClient` avant `router.fromServer` ; spawn avec `command.cwd ?? rootPath` ; `processId: null` en WSL. `LspSessionManager` transmet `resolved.wsl`. Routeur inchangé.
- Écart : la racine client vient de `WslUriMapper.clientRootUri` (ajouté) au lieu de `pathToFileURL(rootPath)`, car `node:url` sous bun ne sait pas construire une URI UNC (cf. T07) ; le nom du dossier vient de `win32.basename`. Même forme qu'avant sous Windows, hors encodage de caractères rares.
- Tests : le faux serveur écrit ce qu'il reçoit (`FAKE_LSP_RECORD`) et répond à `references` / `workspace/symbol` ; une session réelle prouve l'aller-retour definition / references / workspace/symbol, `initialize`, `workspace/workspaceFolders`, `didClose` de `detachPort` et le cwd. Mutations (cwd, processId, toServer, toClient) toutes détectées.
- T09b : liens `file:///home/...` dans le Markdown du hover non traduits (hors périmètre) ; `initializationOptions` toujours non traduites (chemins Linux attendus). Le vrai `wsl.exe` reste à valider à la main (T10).
- Hors tâche : `pty-pane-materialization-race`, `pty-launch-race-parity`, `pty-runtime-hidden-at-spawn-mark` (ipc) échouent par intermittence sous charge avec `pnpm test src/main/lsp src/main/ipc`, verts isolés ; sans lien avec le LSP.
- Revue (orchestrateur) : test WSL rendu déterministe (attend aussi la réponse `workspace/workspaceFolders`, enregistrée de façon asynchrone par le faux serveur). Rejeté : le `cwd` natif ne peut pas changer, `resolveLspServerCommand` ne pose `command.cwd` que dans la branche WSL. Tests pty de `src/main/ipc` instables sous charge, déjà signalés dans la PR #24703.
