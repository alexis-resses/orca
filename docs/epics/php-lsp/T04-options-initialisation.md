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

## Notes de sortie

**Pour T05 : la fixture `src/main/lsp/__fixtures__/php-project/` existe déjà** (T05 §1 : `composer.json` PSR-4 `App\\` → `src/`, `src/Greeter.php`, `src/Service/Mailer.php`, `src/app.php`, pas de `vendor/`) + `var/cache/dev/Greeter.php` (doublon `App\Greeter` façon cache Symfony, ne pas supprimer). Lignes 0-based utiles : `app.php` 7:16 `new Greeter` → `Greeter.php` 6 ; 8:16 `->greet` → `Greeter.php` 14. **T05 : ne pas faire `test.skip` sur `intelephense --version`** (il n'existe pas, sort en 1) ; tester la présence sur le PATH.

**Options retenues (vérifiées sur Phpactor 2026.10.07.0 via `config:dump`, Intelephense 1.18.5 via le code du paquet npm)**

| Serveur | Option | Pourquoi |
|---|---|---|
| Phpactor (`initializationOptions`) | `language_server_{phpstan,psalm,php_cs_fixer,mago}.enabled`, `php_code_sniffer.enabled` = false | Déjà false par défaut, mais posés pour qu'un `~/.config/phpactor/phpactor.json` ne les réactive pas (les `initializationOptions` priment). Clés inconnues ignorées sans erreur (testé), donc `mago` est sans risque sur une version plus ancienne. |
| | `language_server.diagnostics_on_{open,update,save}` = false, `language_server_worse_reflection.diagnostics.enable` = false | Diagnostics poussés = seul coût CPU hors requête ; plus aucun `publishDiagnostics` observé. Complétion / formatage / code actions ne coûtent rien : seulement sur requête, et l'allowlist du routeur ne les laisse jamais passer. |
| | `indexer.exclude_patterns` = 4 défauts + `/var/cache/**/*`, `/var/log/**/*`, `/node_modules/**/*` | La valeur remplace les défauts, d'où leur répétition. `vendor/` reste indexé. |
| | `symfony.enabled` non touché (false par défaut) | Complétion de services du conteneur, rien pour F12 ; laisse le choix à l'utilisateur. |
| Intelephense (`workspaceConfiguration.intelephense`, nouveau champ du catalogue) | `diagnostics.enable` = false, `telemetry.enabled` = false, `files.exclude` = 10 défauts + `**/var/cache/**`, `**/var/log/**` | Intelephense **ignore** les réglages dans `initializationOptions` (n'y lit que `storagePath`, `globalStoragePath`, `clearCache`, `licenceKey`) et les lit par `workspace/configuration` (sections `intelephense`, avec et sans `scopeUri`). Le routeur répondait `null` → défauts → **F12 renvoyait aussi `var/cache`** (mesuré). Télémétrie : false par défaut, posée explicitement. |
| Intelephense `initializationOptions` | `{}` | Stockage par défaut hors du repo (`$XDG_CONFIG_HOME` ou `~/.config/intelephense/{workspace/<hash>,global}`, `%APPDATA%\intelephense` sous Windows). Licence : lue dans `<globalStorage>/licence.txt` si présente → aucun réglage Orca, aucune clé dans le repo. |

- Mécanisme : `ExternalLanguageServer.workspaceConfiguration?` (section → valeur) ; `workspaceConfigurationFor(serverId)` ; `LspSession` le passe au `LspMessageRouter`, qui répond la valeur de la section ou `null` (inchangé pour TS/Ruby). Rien de dépendant du runtime, donc rien dans `resolveLspServerCommand`.
- Version de PHP analysée : **aucun réglage ajouté**. Phpactor lit `composer.json` lui-même (`php.version: null` → plateforme puis `require.php`, puis PHP qui l'exécute). Intelephense prend 8.5 par défaut (`environment.phpVersion`), ce qui ne change quasiment rien pour definition/hover/references (surtout les diagnostics et les stubs). YAGNI : champ à ajouter si T10 montre un écart sur un projet legacy.
- Mémoire : Phpactor relève `memory_limit` à `core.min_memory_limit` (1,5 Go) ; l'index du fixture fait ~60 Mo. `intelephense.maxMemory` est un réglage **du client VS Code** (il lance node avec `--max-old-space-size`), le serveur ne le lit pas. Pas de plafond posé (risque d'OOM sur un gros projet) ; contournement possible par commande personnalisée `node --max-old-space-size=N <chemin>/intelephense.js --stdio`.

**Sonde Intelephense** : `versionArgs: null` = « pas d'option de version, présent sur le PATH suffit ». `lsp-probe.ts` ne lance alors rien et renvoie `installed` avec `version: ''` ; le badge affiche « Installed » (nouvelle clé `installed`, 6 locales + `en-runtime-required.json`). Écarté : lire le `package.json` à côté du binaire (dépend de npm et des shims `.cmd` Windows), lancer une poignée de main LSP (lourd), `--stdio` stdin fermé (sort en 1 dans tous les cas). Avantage : la sonde ne lance plus de code pour ce serveur. Limite : un shim de gestionnaire de versions (asdf/volta) sans le paquet serait vu « installé ». Sonde réelle : `phpactor` → `Phpactor 2026.10.07.0`, `intelephense` → installé.

**Résultats headless** (script jetable hors repo, mêmes `initialize`/réponses serveur que `lsp-session.ts`/`lsp-message-router.ts`, options lues dans le catalogue TS) :

| Requête | Phpactor | Intelephense |
|---|---|---|
| Capacités definition / references / hover / workspaceSymbol | toutes `true` | toutes `true` |
| F12 `new Greeter` / `->greet` (app.php, Mailer.php, `use`) | `src/Greeter.php` 6 / 14 | idem (1 seul résultat) |
| F12 `new Mailer` | `Mailer.php` 8 | `Mailer.php` 8 + constructeur 10 |
| Shift+F12 `greet` | Mailer.php 16, app.php 8 | idem |
| Shift+F12 `Greeter` | 2 usages (sans les `use`) | 4 (avec les `use`) |
| Survol `greet` | signature + doc + `@param`/`@return` | idem |
| `workspace/symbol Greeter` | `App\Greeter` (src) | `Greeter` (src) + variables `$greeter` |
| `var/cache` — sans options | F12 ok (autoload PSR-4), mais `workspace/symbol` → **var/cache** après un `touch` du cache (index par FQN : le dernier indexé gagne) | F12 / survol / symbol → **src + var/cache** |
| `var/cache` — avec options | jamais (index neuf et index déjà pollué : entrée purgée) | jamais (état neuf et état existant) |
| Démarrage / indexation / stderr | init 0,2 s, index 562 fichiers (stubs) 2,3 s ; stderr : `Starting language server…` seulement ; aucune requête serveur | init 0,4 s ; stderr vide ; une requête `workspace/configuration` ; `publishDiagnostics` vides seulement |

**Limites / à transmettre**
- Multi-worktrees : chaque worktree a son index (Phpactor `%cache%/index/<nom>-<hash du chemin>`, Intelephense `workspace/<hash>`). Partager n'est **pas sûr** : les index stockent des chemins absolus (F12 ouvrirait l'autre worktree, branche différente), et aucun des deux serveurs ne verrouille l'index pour plusieurs écrivains. Coût : une indexation par worktree (~2 s ici, plus sur Symfony).
- Phpactor : `language_server.enable_trust_check` reste actif → un `.phpactor.json` du repo est ignoré (« not trusted ») tant que l'utilisateur ne l'a pas approuvé ; la `showMessageRequest` reçoit `null`. Bien pour la sécurité, mais une config projet ne s'applique pas.
- **Ctrl+clic terminal avec Phpactor (non corrigé, hors liste de lecture)** : `'php'` est ajouté à `LOOKUP_LANGUAGES`, mais Phpactor renvoie des noms qualifiés (`App\Greeter`) ; `baseName`/`splitSymbolToken` dans `lsp-workspace-symbol-ranking.ts` ne coupent pas sur `\`, donc le filtre `baseName(name) === 'Greeter'` rejette le résultat. Intelephense (nom court) fonctionne. Correctif probable : couper aussi sur `\` dans ces deux fonctions, avec test.
- Non vérifié ici : Windows natif et WSL (T08/T09), un vrai projet Symfony avec `vendor/` (T10).

**Revue (orchestrateur)** : résultats headless rejoués à l'identique (aucune réponse vers `var/cache/`). Ajouts : Ctrl+clic terminal pour les noms PHP qualifiés (`\` séparateur dans `SYMBOL_TOKEN`, `splitSymbolToken`, `baseName`, tests) — conséquence assumée : un texte `a\b\Foo` dans un terminal TS/Ruby devient un seul token (base `Foo`) au lieu de trois, les liens fichiers gardant la priorité ; `workspace/configuration` résout aussi les sections pointées (`intelephense.files`).
