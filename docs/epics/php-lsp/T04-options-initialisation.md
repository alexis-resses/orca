# T04 — Options d'initialisation et performance des serveurs PHP (spike + implémentation)

## Objectif
Que Phpactor et Intelephense démarrent avec le minimum utile à la navigation, sans coût CPU inutile, et répondent à definition / references / hover / workspace/symbol.

## Contexte
Les options partent dans `initialize.initializationOptions` (voir `lsp-session.ts`). Ruby désactive tout sauf la navigation. Le routeur répond lui-même aux requêtes serveur → client, dont `workspace/configuration` (`lsp-message-router.ts`, vers la ligne 209) : vérifier ce qu'il renvoie, car Intelephense et Phpactor peuvent y lire leur configuration.

## À faire
1. **Spike (30 min max, à consigner dans les notes de sortie)** : à partir de la doc officielle de chaque serveur, lister les options qui coupent complétion, diagnostics, formatage, et celles qui comptent pour la navigation :
   - Intelephense : `storagePath`, `globalStoragePath`, `licenceKey` (optionnel, ne jamais le stocker dans le repo), `clearCache` ; vérifier sa valeur par défaut de stockage.
   - Phpactor : désactivation des extensions d'analyse (PHPStan, Psalm, php-cs-fixer), extension Symfony, motifs d'exclusion de l'indexeur (garder `vendor/`, sinon pas de définition des classes Symfony).
2. **Performance et justesse sur Symfony et legacy** (vérifier les noms d'options dans la doc de chaque serveur) :
   - exclure de l'indexation `var/cache/` (conteneur Symfony généré : doublons de classes, faux usages), `var/log/`, `node_modules/` ; garder `vendor/` ;
   - version de PHP **analysée** configurable par projet (un projet legacy peut être en PHP 7.x), distincte du PHP qui exécute Phpactor (8.1+) ; décider si on la lit depuis `composer.json` (`require.php` / `config.platform.php`) ou si on expose un champ dans les réglages — choisir le plus simple et le justifier ;
   - limite mémoire d'Intelephense ;
   - plusieurs worktrees du même repo lancent chacun une session (jusqu'à 3 par serveur) : regarder si un stockage / cache partagé par repo est possible et sûr ; sinon le documenter comme limite.
3. Renseigner `initializationOptions` dans le catalogue. Si une option dépend du runtime (chemin de stockage dans le dossier de données d'Orca, par exemple), l'ajouter dans `resolveLspServerCommand` plutôt que dans le catalogue, avec un test.
4. Vérifier que la réponse du routeur à `workspace/configuration` ne réactive pas ce qu'on a coupé ; sinon, la faire renvoyer `null` par section ou les valeurs du catalogue.
5. Vérifier que les capacités annoncées par chaque serveur couvrent les 4 méthodes de l'allowlist.

## Fichiers à lire
- `src/shared/language-server-catalog.ts`
- `src/main/lsp/lsp-server-command.ts` et `.test.ts`
- `src/main/lsp/lsp-message-router.ts` (sections `workspace/configuration` et allowlist)
- `src/main/lsp/lsp-session.ts` (méthode `initialize` uniquement)

## Critères d'acceptation
- Sur un projet PHP natif (Windows ou fixture de T05), les deux serveurs démarrent sans erreur dans les logs (`stderr` tail) et répondent à `F12`.
- Un `F12` dans `src/` n'ouvre jamais un fichier de `var/cache/`.
- Les options choisies et leur justification figurent dans les notes de sortie (utile pour la PR amont).

## Commit
`feat(lsp): navigation-only initialization and indexing options for PHP servers`
