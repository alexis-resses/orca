# T09a — Branchement session + routeur pour les repos WSL

## Objectif
La session utilise la commande de T08 et le routeur applique le mapper de T07 : navigation fonctionnelle côté main pour un repo WSL.

## Contexte
`LspSession` construit `rootUri` depuis `rootPath` et passe `workspaceFolders` au routeur ; le routeur relaie les messages entre ports et serveur. Notes de sortie de T07 et T08 à lire en premier.

## À faire
1. `lsp-session.ts` : si le résultat de T08 contient `wsl`, construire `rootUri` / `workspaceFolders` côté Linux et passer le mapper au routeur.
2. `lsp-message-router.ts` : appliquer `toServer` aux messages client et aux requêtes internes, `toClient` aux réponses et à la réponse `workspace/symbol`. Le suivi des documents par URI reste en URI client.
3. Hover : si le contenu Markdown contient des liens `file:///home/...`, les laisser (hors périmètre) mais le noter.
4. Tests d'intégration du routeur avec mapper (aller-retour definition / references / workspace/symbol) et test de session avec le faux serveur.

## Fichiers à lire
- Notes de sortie de T07 et T08
- `src/main/lsp/lsp-session.ts` et `.test.ts`
- `src/main/lsp/lsp-message-router.ts` et `.test.ts`
- `src/main/lsp/lsp-wsl-uri-mapper.ts`

## Critères d'acceptation
- Tests verts, tests existants inchangés.
- Aucun changement UI dans cette tâche.

## Commit
`feat(lsp): route WSL language server sessions through the URI mapper`
