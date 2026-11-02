# EPIC — Navigation PHP (LSP) dans l'éditeur Orca, y compris pour les repos WSL

## Objectif

Dans l'éditeur Monaco d'Orca, sur un projet PHP/Symfony :

- `Ctrl+clic` / `F12` ouvre la définition d'une classe, méthode ou fonction, même dans un autre fichier ou dans `vendor/` ;
- `Shift+F12` liste les usages ;
- le survol affiche la signature et la doc ;
- ça marche pour un repo situé **dans WSL** (`\\wsl.localhost\<distro>\...`) avec Orca lancé **sous Windows**.

Hors périmètre V1 : complétion, diagnostics, formatage, refactoring, debug, coloration sémantique PHP, Twig.

EPIC suivant possible : navigation dans le diff viewer (la PR #24703 n'envoie jamais les modèles de diff au serveur, or c'est là qu'on relit le code des agents).

## Point de départ

- Fork de `stablyai/orca`, branche de travail `feat/php-lsp` créée **depuis la branche de la PR #24703** (`MTEKode/orca`, branche `MTEKode/lsp-navigation`). Cette PR apporte toute la plomberie LSP (sessions, routeur, providers Monaco, réglages par projet) pour TypeScript et Ruby. Elle n'est pas encore fusionnée.
- Plateforme de dev : Windows + WSL. Orca tourne sous Windows, les repos PHP et PHP lui-même sont dans WSL.

## Décisions

| # | Décision | Pourquoi |
|---|----------|----------|
| D1 | Deux serveurs au choix : **Phpactor** (prioritaire en cas d'égalité) et **Intelephense** | Même modèle que Ruby (`ruby-lsp` / `solargraph`), donc acceptable en amont. Phpactor est MIT ; Intelephense est plus rapide mais propriétaire, donc détecté s'il est installé, jamais embarqué. |
| D2 | Navigation uniquement (definition, references, hover, workspace/symbol) | Même périmètre que la PR #24703 ; le routeur n'autorise que ces méthodes. |
| D3 | L'écran de réglages devient générique, piloté par le catalogue | `RepositoryLanguageServersSection.tsx` est codé en dur pour Ruby (`RubyChoice`). Copier-coller pour PHP viole « Reuse Before Reimplementing » et la limite de lignes. |
| D4 | WSL : le serveur tourne **dans la distro** via `wsl.exe --exec`, et le routeur **traduit les URI** UNC ↔ Linux | PHP est dans WSL. Le serveur voit `/home/...`, Monaco voit `\\wsl.localhost\...`. |
| D5 | Conventions d'Orca uniquement | Commits `feat(lsp): …` / `fix(lsp): …` / `test(lsp): …`, règles de `AGENTS.md`. |
| D6 | Deux PR en amont : PHP d'abord, WSL ensuite | Plus facile à relire et à fusionner. |
| D7 | Le fork est un banc de test, lancé en dev (`pnpm dev`), jamais packagé ni installé | L'objectif est la fusion en amont ; l'usage quotidien se fera sur l'Orca officiel. |
| D8 | Signal en amont dès le début (T00b), pas seulement à la fin | Éviter de développer ce que les mainteneurs refuseraient ou feraient autrement. |

## Constats issus de la lecture du code (branche de la PR)

- `src/shared/language-server-catalog.ts` : catalogue déclaratif (`kind: 'external'`, `defaultCommand`, `versionArgs`, `installCommand`, `updateCommand`, `initializationOptions`).
- `src/shared/language-server-types.ts` : `LANGUAGE_SERVER_IDS` fixe l'ordre, donc la priorité en cas d'égalité.
- `src/shared/repo-language-server-settings.ts` : normaliseur « un serveur par langage », ids connus uniquement.
- `src/main/lsp/lsp-session-manager.ts` : seul garde-fou d'hôte = `getRepoExecutionHostId(repo) !== LOCAL_EXECUTION_HOST_ID`. **Aucune mention de WSL dans tout le code LSP.** Un repo WSL est un repo `local` dont le chemin est UNC (`parseWslUncPath` dans `src/shared/wsl-paths.ts`). Conséquence probable aujourd'hui : Orca lance le binaire **Windows** avec un cwd UNC. À confirmer en T06.
- `src/main/lsp/lsp-session.ts` : `spawnProcess` avec `cwd: rootPath`, `rootUri = pathToFileURL(rootPath)`.
- `src/main/lsp/lsp-message-router.ts` : allowlist des méthodes, réponses aux requêtes serveur (dont `workspace/configuration`). Point naturel pour traduire les URI.
- Monaco détecte déjà `.php` → `php` (`src/renderer/src/lib/language-detect.ts`).
- Briques WSL existantes à réutiliser : `buildWslExecArgs` (`src/shared/wsl-login-shell-command.ts`), `resolveWslExecutablePath` (`src/main/wsl/wsl-executable-path.ts`), `resolveWslInteropSpawnCwd`, `toLinuxPath` / `toWindowsWslUncPath` (`src/shared/wsl-paths.ts`), modèle de process long dans `src/main/wsl/wsl-orcad-host-transport.ts`.

## Plan

| Tâche | Titre | Dépend de | Taille | Modèle conseillé |
|-------|-------|-----------|--------|------------------|
| T00 | Mise en place du fork et baseline | — | S | Sonnet |
| T00b | Signal en amont (MTEKode, issue #5247) | T00 | XS | Sonnet |
| **Phase 1 — PHP natif** | | | | |
| T01 | Entrées Phpactor et Intelephense dans le catalogue | T00 | S | Haiku / Sonnet |
| T01b | Déclarer PHP côté éditeur (synchro + providers) — trou relevé en T06 | T01 | XS | Sonnet |
| T02 | Écran de réglages générique piloté par le catalogue | T01 | M | Sonnet |
| T03 | Commandes d'installation / mise à jour des serveurs PHP | T02 | S | Haiku / Sonnet |
| T04 | Options d'initialisation et performance des serveurs PHP | T01b, T03 (catalogue partagé) | M (spike) | Opus |
| T05 | Projets de test PHP (Composer + legacy sans Composer), tests unitaires et e2e | T01, T04 | M | Sonnet |
| **Phase 2 — WSL** | | | | |
| T06 | Spike : comportement actuel d'un repo WSL et conception | T00 | S (spike) | Opus |
| T07 | Traduction des URI UNC ↔ Linux (module pur) | T06 | M | Sonnet |
| T08 | Lancement et détection du serveur dans la distro WSL | T06 | M | Sonnet |
| T09a | Branchement session + routeur pour les repos WSL | T07, T08 | M | Opus |
| T09b | Réglages actifs pour les repos WSL et validation de bout en bout | T09a, T02 | S | Sonnet |
| T10 | Validation manuelle sur un projet Symfony public et un projet PHP legacy public | T05, T09b | S | — (manuel) |
| **Phase 3 — Amont** | | | | |
| T11 | Rebase et préparation des deux PR en amont | T10 + fusion de #24703 | S | Sonnet |

**Seuil d'arrêt** : si une tâche dépasse environ deux fois sa taille (S ≈ 1 session courte, M ≈ 1 session complète) ou si la session doit lire des fichiers hors de sa liste pour avancer, l'agent s'arrête, écrit ses notes de sortie et la tâche est redécoupée.

Parallélisable (worktrees séparés) : **T06 avec T01–T03** (T06 ne modifie pas de code produit), **T07 avec T08** (fichiers disjoints), **T04 avec T02**.

## Règles pour l'agent (à lire au début de chaque tâche)

Chaque tâche est lancée dans **une nouvelle session, sans historique**. Prompt de lancement type :

> Lis `docs/epics/php-lsp/README.md` (sections « Décisions », « Constats » et « Règles ») puis `docs/epics/php-lsp/Txx-*.md`, et exécute la tâche. Ne lis que les fichiers listés, sauf si un critère d'acceptation l'exige.

Règles :

1. **Liste de lecture fermée.** Lis les fichiers listés dans la tâche, pas le repo entier. Une recherche ciblée (`rg`) est permise pour trouver un symbole précis.
2. **Respecte `AGENTS.md`** : pas de `max-lines` désactivé, commentaires d'une ligne au plus (« Why: … »), pas de `as` sans `SAFETY:`, `spawnProcess` de `@orca/process-host` uniquement, `path.join`, pas de noms `utils`/`helpers`, chaînes UI traduites dans les 6 locales (`en`, `es`, `fr`, `ja`, `ko`, `zh`) + `en-runtime-required.json` si besoin.
3. **Vérifications avant commit** : `pnpm tc`, `pnpm test <fichiers de test touchés>`, `pnpm run check:code-quality:changed`, `pnpm format`. Tests e2e : toujours avec `ORCA_BACKGROUND_LAUNCH=1`, jamais de fenêtre visible.
4. **Commit** via `dev-commit`, format Conventional Commits d'Orca (`feat(lsp): …`), sans référence de ticket externe.
5. **Fin de tâche** : coche la tâche dans le tableau d'avancement ci-dessous et ajoute en bas de la tâche une section `## Notes de sortie` (3 à 6 lignes : ce qui a été fait, écarts au plan, points à transmettre à la tâche suivante). C'est **le seul canal** entre deux sessions.
6. Si un critère est impossible ou si le plan est faux, **arrête-toi** et écris pourquoi dans les notes de sortie plutôt que d'improviser une grosse déviation.

## Avancement

- [ ] T00 · [ ] T00b · [x] T01 · [x] T01b · [x] T02 · [x] T03 · [x] T04 · [ ] T05
- [x] T06 · [x] T07 · [x] T08 · [x] T09a · [ ] T09b · [ ] T10 · [ ] T11

## Définition de fini de l'EPIC

Sur un projet PHP natif sans framework, `Ctrl+clic` résout fonctions globales, classes incluses et méthodes typées avec au moins un des deux serveurs ; les limites (appels dynamiques) sont documentées.

Sur un repo Symfony dans WSL (projet public), ouvert dans Orca Windows, avec Phpactor puis avec Intelephense : `Ctrl+clic` sur une classe applicative, un service Symfony de `vendor/` et une méthode ouvre le bon fichier à la bonne ligne ; `Shift+F12` liste les usages ; le survol affiche la signature. Aucun test existant cassé, `pnpm tc` vert.
