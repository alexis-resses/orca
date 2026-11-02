# T07 — Traduction des URI UNC ↔ Linux (module pur)

## Objectif
Un module sans effet de bord qui réécrit les URI de tous les messages LSP autorisés, dans les deux sens, pour une distro donnée. Il sera branché en T09a.

## Contexte
Monaco voit `file://wsl.localhost/<distro>/home/...` (ou `file://wsl%24/<distro>/...`, fragment `#ownerKey` possible : forme exacte dans T06 §3.3) ; le serveur dans WSL voit `file:///home/...`. Aujourd'hui rien ne traduit. Le routeur ne laisse passer qu'une allowlist de méthodes, ce qui borne la liste des champs.

## À faire
1. Créer `src/main/lsp/lsp-wsl-uri-mapper.ts` exposant `createWslUriMapper(rootPath: string): WslUriMapper | null` (null si `rootPath` n'est pas un UNC WSL) → `{ toServer(message), toClient(message) }`, qui renvoie une **copie** du message. Le mapper garde le partage (`wsl.localhost` / `wsl$`) et la casse de distro de `rootPath` pour `toClient`.
2. S'appuyer sur `parseWslUncPath`, la branche lecteur de `toLinuxPath`, `toWindowsWslDrivePath` et `toWindowsWslUncPath` (`src/shared/wsl-paths.ts`), et sur `pathToFileURL` / `fileURLToPath` **avec `{ windows: true | false }` explicite**. `toLinuxPath` ne convertit l'UNC que sous win32 : appeler `parseWslUncPath` directement (les tests tournent sous Linux). Gérer `wsl$` et `wsl.localhost`, la casse de la distro, une autre distro (inchangée), les caractères encodés (`%20`, accents), `?query` / `#fragment` conservés, les chemins DrvFs (règles du tableau de T06 §3.3 : sous la racine → forme de `rootPath`, `/mnt/<x>` hors racine → `X:\...`).
3. Traduction par **nom de clé**, parcours profond, sans regarder la méthode : `toServer` réécrit les clés `uri` et `rootUri`, `toClient` les clés `uri`, `targetUri` et `scopeUri` (listes et justification dans T06 §3.3). Les autres chaînes (`text`, `contents`…) sont intactes. Une URI qui n'est pas `file:` passe inchangée.
4. Tests unitaires exhaustifs (un cas par champ et par sens, aller-retour identique en chemins décodés, `wsl$`, autre distro, DrvFs dans et hors racine, fragment, URI non `file:`, message sans `params`).

## Fichiers à lire
- `docs/epics/php-lsp/T06-conception-wsl.md`
- `src/shared/wsl-paths.ts` et son test
- `src/main/lsp/lsp-message-router.ts` (allowlist et forme des messages, lecture seule)
- `src/renderer/src/lib/lsp/lsp-conversions.ts` (formes `Location` / `LocationLink`)

## Critères d'acceptation
- Module pur, aucun import Electron, couvert à 100 % de ses branches par les tests.
- `pnpm tc` vert.

## Commit
`feat(lsp): map LSP file URIs between WSL UNC and Linux paths`
