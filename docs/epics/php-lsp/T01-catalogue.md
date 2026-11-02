# T01 — Entrées Phpactor et Intelephense dans le catalogue

## Objectif
Déclarer les deux serveurs PHP pour qu'ils puissent être activés, détectés et lancés comme les serveurs Ruby, sur un hôte natif.

## Contexte
Catalogue déclaratif, un seul serveur par langage, l'ordre de `LANGUAGE_SERVER_IDS` donne la priorité (Phpactor gagne contre Intelephense, comme `ruby-lsp` contre `solargraph`). Langage Monaco : `php`.

## À faire
1. `src/shared/language-server-types.ts` : ajouter `'phpactor'` puis `'intelephense'` à la fin de `LANGUAGE_SERVER_IDS`.
2. `src/shared/language-server-catalog.ts` : deux entrées `kind: 'external'`, `languageIds: ['php']` :
   - `phpactor` : label `Phpactor`, `defaultCommand: ['phpactor', 'language-server']`, `versionArgs: ['--version']`.
   - `intelephense` : label `Intelephense`, `defaultCommand: ['intelephense', '--stdio']`, `versionArgs: ['--version']`.
   - `installCommand` / `updateCommand` : valeurs provisoires, finalisées en T03.
   - `initializationOptions: {}` provisoire, finalisé en T04.
3. Tests du normaliseur : PHP activé seul, deux serveurs PHP activés → seul `phpactor` reste, override de commande accepté pour les deux.
4. Si un test ou un type énumère les ids (probe, settings), l'adapter.

## Fichiers à lire
- `src/shared/language-server-types.ts`
- `src/shared/language-server-catalog.ts`
- `src/shared/repo-language-server-settings.ts` et `.test.ts`
- `src/main/lsp/lsp-probe.ts` et `.test.ts`

## Critères d'acceptation
- `pnpm tc` vert, tests ci-dessus verts.
- Aucun changement d'UI dans cette tâche (l'UI ne montrera PHP qu'en T02).

## Commit
`feat(lsp): add Phpactor and Intelephense to the language server catalog`
