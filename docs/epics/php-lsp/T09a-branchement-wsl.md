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
