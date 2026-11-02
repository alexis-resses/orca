# T01b — Déclarer PHP côté éditeur (synchro des documents et providers)

## Objectif
Que les modèles Monaco `php` soient synchronisés avec le serveur et que `F12` / `Shift+F12` / survol passent par lui. Sans cela, aucune navigation PHP ne fonctionne, même sur un repo natif.

## Contexte
Trou du plan relevé en T06 : `LSP_LANGUAGE_IDS` (`src/renderer/src/lib/lsp/lsp-document-sync.ts:4`) vaut `['typescript', 'javascript', 'ruby']`. Il filtre les modèles synchronisés (`lsp-document-sync.ts:43`) et les langages sur lesquels les providers sont enregistrés (`lsp-navigation-providers.ts:21`). Quand aucun serveur n'est disponible, les providers retombent sur le worker TypeScript de Monaco : ce repli n'a pas de sens pour PHP.

## À faire
1. Ajouter `'php'` à `LSP_LANGUAGE_IDS`.
2. Vérifier dans `lsp-navigation-providers.ts` le repli sur le worker TS : pour `php` (comme pour `ruby`), sans serveur, le provider ne doit rien renvoyer plutôt qu'appeler le worker TS. Reproduire exactement le traitement actuel de `ruby`.
3. Si un autre endroit du renderer énumère les langages LSP en dur (`rg "'ruby'" src/renderer/src/lib/lsp`), l'aligner.
4. Tests : un modèle `php` est synchronisé (`lsp-document-sync.test.ts`), les providers sont enregistrés pour `php` et ne tombent pas sur le worker TS sans serveur (`lsp-navigation-providers.test.ts`).

## Fichiers à lire
- `src/renderer/src/lib/lsp/lsp-document-sync.ts` et `.test.ts`
- `src/renderer/src/lib/lsp/lsp-navigation-providers.ts` et `.test.ts`

## Critères d'acceptation
- `pnpm tc` vert, tests `src/renderer/src/lib/lsp` verts, aucun test existant modifié sans justification.
- Aucun changement d'UI.

## Commit
`feat(lsp): sync PHP editor models with the language server`

## Notes de sortie
- `'php'` ajouté à `LSP_LANGUAGE_IDS` (`lsp-document-sync.ts`) : modèles `php` synchronisés et providers enregistrés pour `php`.
- Plan confirmé : le repli TS (`lsp-typescript-worker-fallback.ts`) renvoie déjà `null` pour tout langage autre que typescript/javascript, donc aucun changement dans `lsp-navigation-providers.ts`. `lsp-workspace-symbol-lookup.ts` (`LOOKUP_LANGUAGES`) et `lsp-semantic-tokens.ts` énumèrent `ruby` en dur : volontairement non touchés (hors périmètre V1 : workspace/symbol PHP et coloration sémantique), à voir en T04/T05 si besoin.
- Tests ajoutés (aucun test existant modifié) : sync d'un modèle `php`, enregistrement des 3 providers pour `php`, hover/definition/references `php` sans client renvoient `null` sans appeler le worker TS.
- Vérifs : `pnpm tc`, `pnpm test src/renderer/src/lib/lsp` (67 tests), gate qualité, `pnpm format` verts.
