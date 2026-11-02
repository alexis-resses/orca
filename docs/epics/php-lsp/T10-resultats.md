# T10 — Résultats de validation

## 2026-11-02 — Orca Linux (WSLg), repos dans la distro (phase 1, PHP natif)

- Contexte : Orca dev lancé **dans WSL** (Ubuntu, `pnpm dev`, fenêtre via WSLg), projets sur le disque Linux : `~/php-lsp-test` (fixture Composer) et `~/php-lsp-legacy-test` (fixture legacy). Phpactor 2026.10.07.0, Intelephense 1.18.5.
- Verdict d'Alexis après essai manuel : « ça me paraît ok » (F12, Shift+F12, survol, réglages ; détail par geste non relevé).
- **Ne couvre pas** la phase 2 (Orca Windows → repo `\\wsl.localhost\...`) ni les projets publics Symfony / legacy de T10 : restent à faire.

## 2026-11-02 — Recette mesurée (Claude), WSL Ubuntu, projets publics

Projets dans la distro (disque Linux) : `symfony/demo` (`composer install --no-scripts --ignore-platform-req=ext-pdo_sqlite`, 9 404 fichiers PHP dans `vendor/`) et `WordPress/WordPress` (PHP natif sans Composer, 2 083 fichiers PHP). Serveurs pilotés en headless avec **les options exactes du catalogue** et les réponses du routeur d'Orca (`workspace/configuration`, `workspace/workspaceFolders`). Phase 2 (Orca Windows → UNC) **non couverte**.

### Mesures

| Serveur / projet | 1re réponse F12 (froid) | Index complet | À chaud (médiane) | RSS pic / repos |
|---|---|---|---|---|
| Phpactor / Symfony | 1,2 s (autoload Composer) | ~26-34 s | 2 ms | 962 Mo / 275 Mo |
| Phpactor / WordPress | 2,7 s | ~9-16 s | 4 ms | 665 Mo / 138 Mo |
| Intelephense / Symfony | 1,9 s | ~10-16 s | 1 ms | 429 Mo / 429 Mo |
| Intelephense / WordPress | 2,5 s | ~4-11 s | 1 ms | 397 Mo (809 Mo après `references` massif) / 397 Mo |

3 worktrees simultanés sur Symfony (copies distinctes) : Phpactor ~2,9 Go de pics cumulés puis ~0,85 Go au repos, index 42-44 s ; Intelephense ~1,9 Go résidents, index 18-20 s. Arrêt `shutdown`/`exit` propre dans tous les cas.

### Gestes (origine → résultat)

| Cas | Phpactor | Intelephense |
|---|---|---|
| Symfony : classe de `src/` (`Post`) | OK (ligne de l'attribut `#[ORM\Entity]`, 3 lignes au-dessus de `class`) | OK |
| Symfony : méthode héritée `$this->render` → `AbstractController` | OK | OK |
| Symfony : interface `EventSubscriberInterface` | **KO** : `phar://…/maker-bundle/…/php-cs-fixer.phar/…` (copie embarquée, non ouvrable) | OK |
| Symfony : `Request`, `EntityManagerInterface` (vendor) | OK | OK |
| Symfony : fonction native `\sprintf` | stub dans le PHAR Phpactor (`phar://`, non ouvrable) | stub fichier réel, ouvrable |
| Symfony : hover méthode documentée | OK | OK (plus riche : `@param` / `@return`) |
| Symfony : `references` `Post::getSlug` | 4 / 4 fichiers, 337 ms | 4 / 4 fichiers, 29 ms |
| WordPress : fonction globale d'un fichier inclus | OK | OK |
| WordPress : `new WP()` / `new WP_Rewrite` | OK (ligne de l'attribut) | OK |
| WordPress : méthode du retour `@return` (`wp_get_current_user()->for_site`) | OK | OK |
| WordPress : méthode d'un `global $wp_rewrite` non typé | KO | KO (limite statique) |
| WordPress : constantes `ABSPATH` / `WPINC` (plusieurs `define`) | un seul candidat, pas toujours le principal | tous les candidats, dont le bon |
| WordPress : `references` `apply_filters` | 2 523 / 414 fichiers, 4,3 s | 2 440 / 415 fichiers, 3,9 s (dépasse le plafond d'aperçu de 100 fichiers) |

Appels non résolubles statiquement dans WordPress : ~430 appels dynamiques (`call_user_func*`, `->$m(`, `->{$`, `new $`, `$fn()`), 1 743 `add_filter`/`add_action` par nom, 1 250 `global $x` sans type.

### Processus orphelins

- Fermeture normale d'Orca Dev (WSLg) avec Phpactor actif : Phpactor arrêté proprement.
- **Phpactor ne s'arrête ni sur EOF de stdin ni sur la mort du `processId` parent** (testé ; un Phpactor lancé par le script du spike T04 a survécu 1 h 42 à son parent). Intelephense sort sur EOF. Conséquence : après un **crash** d'Orca (pas une fermeture normale), un Phpactor peut rester en mémoire sur un hôte natif. Limite du serveur, à documenter dans la PR.
- Non testé : crash d'Orca Windows avec un serveur dans WSL (T06 : tuer `wsl.exe` tue le processus Linux).

### Recommandation par type de projet

| Projet | Serveur conseillé | Pourquoi |
|---|---|---|
| Symfony | **Intelephense** | aucun KO (Phpactor : interface résolue dans un PHAR), index 2× plus rapide, `references` ~10× plus rapide, hover plus riche ; coût ~430 Mo par session |
| PHP natif (WordPress) | **Intelephense** | constantes multiples et types de retour sans docblock mieux suivis, index 2× plus rapide |
| Mémoire contrainte / licence libre exigée | Phpactor | ~140-280 Mo au repos, MIT |

Le réglage reste par projet ; la priorité Phpactor de D1 ne joue que si les deux sont cochés.

### Reste à faire

Phase 2 sur Windows (check-list de `T09b-reglages-wsl.md`), plafond d'aperçu de 100 fichiers vu dans l'interface, exclusion `var/cache` sur un vrai cache Symfony (non généré : `cache:warmup` non lancé ; l'exclusion est prouvée sur la fixture en T04/T05).
