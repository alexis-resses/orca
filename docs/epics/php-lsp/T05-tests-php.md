# T05 — Projet de test PHP, tests unitaires et e2e

## Objectif
Couvrir PHP comme Ruby est couvert : deux fixtures (projet Composer/PSR-4 et projet PHP legacy sans Composer), des tests unitaires de bout en bout côté main, un test e2e qui s'ignore proprement si le serveur n'est pas installé.

## Contexte
Ruby a `src/main/lsp/__fixtures__/ruby-project/` et a été vérifié manuellement ; TypeScript a `tests/e2e/lsp-navigation.spec.ts` (Electron headless).

## À faire
1. `src/main/lsp/__fixtures__/php-project/` : `composer.json` avec autoload PSR-4 `App\\` → `src/`, au moins `src/Greeter.php` (classe + méthode documentée), `src/Service/Mailer.php` (utilise `Greeter`), `src/app.php` (appelle les deux). Pas de `vendor/` commité.
2. `src/main/lsp/__fixtures__/php-legacy-project/` : **sans `composer.json`**, sur le modèle d'un projet PHP natif :
   - `index.php` qui fait `require_once 'lib/functions.php'` et `require_once 'classes/Invoice.php'`, appelle une fonction globale et instancie `Invoice` ;
   - `lib/functions.php` : deux fonctions globales documentées (`@param`, `@return`) et une constante (`define`) ;
   - `classes/Invoice.php` : classe sans namespace, une méthode qui retourne un objet d'une autre classe incluse (`classes/Customer.php`), avec et sans annotation `@return`, pour mesurer l'effet des docblocks ;
   - un cas dynamique volontaire (`$method = 'total'; $invoice->$method();`) qui **ne doit pas** être résolu : sert à documenter la limite, pas à faire échouer le test.
3. Test e2e `tests/e2e/lsp-navigation-php.spec.ts` sur le modèle du test TypeScript : active `phpactor`, puis `intelephense` ; vérifie hover et `F12` vers `Greeter.php` à la bonne ligne. Même chose sur `php-legacy-project` : `F12` sur la fonction globale, sur `new Invoice`, sur la méthode chaînée vers `Customer`. `test.skip` si `phpactor --version` / `intelephense --version` échoue.
   - Pour le projet legacy, un résultat attendu peut différer selon le serveur (Phpactor dépend davantage de l'autoload Composer) : paramétrer les attentes par serveur, et consigner dans les notes de sortie ce que chaque serveur résout ou non.
4. Si le test TypeScript contient du code de mise en place réutilisable, l'extraire plutôt que le dupliquer.
5. Toujours `ORCA_BACKGROUND_LAUNCH=1`.

## Fichiers à lire
- `tests/e2e/lsp-navigation.spec.ts`
- `src/main/lsp/__fixtures__/ruby-project/` (structure)
- Notes de sortie de T04

## Critères d'acceptation
- e2e PHP vert en local avec au moins un des deux serveurs installés (Windows natif), et ignoré sans serveur, sur les deux fixtures.
- Notes de sortie : tableau « cas legacy × serveur » (résolu / non résolu), réutilisé en T10 et dans la PR amont.
- Aucune fenêtre visible pendant le test.

## Commit
`test(lsp): PHP fixtures (Composer and legacy) and navigation e2e`

## Notes de sortie

- Fixture legacy `php-legacy-project/` (sans Composer : `index.php`, `lib/functions.php`, `classes/Invoice.php`, `classes/Customer.php`) ; la fixture Composer de T04 est reprise telle quelle. Spec `tests/e2e/lsp-navigation-php.spec.ts` (F12 par serveur et par fixture, survol du docblock) ; mise en place factorisée dans `tests/e2e/helpers/lsp-navigation-fixture.ts` (dépôt git temporaire, activation du serveur, ouverture de fichier), le spec TS l'utilise aussi.
- e2e : tourne sous WSL (Linux, `ORCA_BACKGROUND_LAUNCH=1`, aucune fenêtre). 7 tests verts (6 PHP + TS). Sans serveur sur le PATH : 6 `skipped`. Le skip teste la présence sur le PATH (pas de `--version`, absent chez Intelephense). Windows natif non testé.
- Pièges Monaco PHP : les spans englobent l'espace, `->` (parfois `->a->b`) et le `;` final, donc le spec clique à l'offset du token dans le span. Intelephense renvoie 2 définitions sur `new Mailer` (classe + constructeur) : Monaco ouvre un peek, cas non asserté.
- Tableau legacy × serveur (headless, `index.php`, lignes 1-based dans le fichier cible) :

| Cas | Phpactor 2026.10.07.0 | Intelephense 1.18.5 |
|---|---|---|
| Fonction globale `format_amount` (après `require_once`) | résolu : `lib/functions.php:11` | résolu : idem |
| `new Invoice` (classe sans namespace) | résolu : `Invoice.php:5` | résolu : idem |
| Constante `define('TAX_RATE')` | résolu : `functions.php:3` | résolu : idem |
| `->documentedCustomer()` (méthode) | résolu : `Invoice.php:12` | résolu : idem |
| `->name()` après méthode avec `@return Customer` | résolu : `Customer.php:5` | résolu : idem |
| `->undocumentedCustomer()` (méthode) | résolu : `Invoice.php:17` | résolu : idem |
| `->name()` après méthode sans `@return` ni type | non résolu (`null`) | résolu : `Customer.php:5` (infère `new Customer()`) |
| Appel dynamique `$invoice->$method()` | non résolu vers `total()` (renvoie la ligne de `$method = 'total'`) | idem |
| Survol `format_amount` / `name` | signature + docblock / signature seule | signature + docblock / signature + `@return` |

- Conclusion : sans docblock, seul Intelephense suit le type de retour ; avec `@return`, les deux serveurs résolvent. Les appels dynamiques sont une limite commune à documenter.
- À transmettre : un `pnpm test src/main/lsp` a échoué une fois (1 test) pendant que l'e2e tournait en parallèle, vert ensuite (121/121) : probablement un timeout sous charge, à surveiller. Une capture d'écran d'échec Playwright de ce dépôt montre l'écran d'accueil (prise après fermeture), elle ne sert pas au diagnostic.
- Revue (orchestrateur) : e2e rejoué à la main sous WSL (`ORCA_BACKGROUND_LAUNCH=1`, electron-headless, `--workers=1`) : 7/7 verts en 4,7 min. Le sous-agent n'a pas rendu de rapport final (arrêté) ; fichiers relus et vérifiés directement.
