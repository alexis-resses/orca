# T07 — Traduction des URI UNC ↔ Linux (module pur)

## Objectif
Un module sans effet de bord qui réécrit les URI de tous les messages LSP autorisés, dans les deux sens, pour une distro donnée. Il sera branché en T09a.

## Contexte
Monaco voit `file://wsl.localhost/<distro>/home/...` (forme exacte confirmée en T06) ; le serveur dans WSL voit `file:///home/...`. Aujourd'hui rien ne traduit. Le routeur ne laisse passer qu'une allowlist de méthodes, ce qui borne la liste des champs.

## À faire
1. Créer `src/main/lsp/lsp-wsl-uri-mapper.ts` exposant par exemple `createWslUriMapper(distro)` → `{ toServer(message), toClient(message) }`, qui renvoie une **copie** du message.
2. S'appuyer sur `toLinuxPath` / `toWindowsWslUncPath` (`src/shared/wsl-paths.ts`) et `pathToFileURL` / `fileURLToPath` ; gérer `wsl$` et `wsl.localhost`, la casse de la distro, les caractères encodés (`%20`, accents), les chemins DrvFs (`/mnt/c/...` → `C:\...`, voir `isDrvfsLinuxPath`).
3. Champs traduits : liste de T06 (`textDocument.uri`, `Location.uri`, `LocationLink.targetUri`, tableaux de résultats, `workspace/symbol`, `rootUri`, `workspaceFolders`). Une URI qui n'est pas `file:` passe inchangée.
4. Tests unitaires exhaustifs (un cas par champ et par sens, aller-retour identique, DrvFs, URI non `file:`, message sans `params`).

## Fichiers à lire
- `docs/epics/php-lsp/T06-conception-wsl.md`
- `src/shared/wsl-paths.ts` et son test
- `src/main/lsp/lsp-message-router.ts` (allowlist et forme des messages)
- `src/renderer/src/lib/lsp/lsp-conversions.ts` (formes `Location` / `LocationLink`)

## Critères d'acceptation
- Module pur, aucun import Electron, couvert à 100 % de ses branches par les tests.
- `pnpm tc` vert.

## Commit
`feat(lsp): map LSP file URIs between WSL UNC and Linux paths`
