# T11 — Rebase et préparation des deux PR en amont

## Préalable
La PR #24703 est fusionnée dans `stablyai/orca:main`. Sinon, attendre ou proposer les changements comme PR sur la branche de MTEKode, en accord avec lui.

## À faire
1. Rebase de `feat/php-lsp` sur `upstream/main`, résoudre les conflits, relancer toutes les vérifications du README.
2. Séparer en deux branches :
   - `feat/lsp-php` : T01–T05 (+ T02 en commit de refactor distinct) ;
   - `feat/lsp-wsl` : T07–T09b, basée sur la première.
3. Retirer `docs/epics/` des branches amont.
4. Rédiger chaque PR avec `.github/pull_request_template.md` et la section « Writing Pull Requests » d'`AGENTS.md` : avant/après côté utilisateur, mécanisme, pourquoi ce choix (reprendre les justifications de T04 et T06), tests, plateformes testées (Windows + WSL), mention « AI Disclosure ».
5. Lier l'issue #5247 (Cmd+Click cross-file) et #24702.

## Critères d'acceptation
- Deux PR prêtes à ouvrir, chacune verte en local sur `pnpm tc`, tests touchés et `check:code-quality:changed`.

## Commit
Pas de commit de code ; la PR est ouverte par Alexis.

## Notes de sortie

- #24703 **pas encore fusionnée** et pas de réponse de MTEKode au 2026-11-02 : branches construites sur sa tête `215cbee` au lieu d'un rebase sur `upstream/main` (à refaire après fusion : `git rebase --onto upstream/main 215cbee feat/lsp-php`, puis idem pour `feat/lsp-wsl` sur `feat/lsp-php`).
- `feat/lsp-php` (6 commits : T01, T02, T01b, T03, T04, T05) et `feat/lsp-wsl` (4 commits : T07, T08, T09a, T09b) poussées sur le fork, sans `docs/epics/` ; messages et auteurs d'origine conservés. Code de `feat/lsp-wsl` identique à `feat/php-lsp` hors `docs/epics/`.
- Vérifié depuis `215cbee` : `feat/lsp-php` seule → `pnpm tc` vert, 1 732 tests verts (lsp, settings, terminal), `check:code-quality:changed` vert ; `feat/lsp-wsl` → qualité, `check:max-lines-ratchet` et contrôles i18n verts.
- Textes de PR prêts : `T11-pr-php.md`, `T11-pr-wsl.md` (TODO Alexis : captures, test Windows, base de PR selon la réponse de MTEKode).

## Ouverture selon la réponse amont

Veille quotidienne : routine cloud `orca-php-lsp-veille-amont` (9 h 03 Paris).

| Situation | Action |
|---|---|
| #24703 fusionnée | Rebase (commandes ci-dessus), relancer les vérifications, ouvrir les issues de `T11-issues.md`, puis PR 1 vers `main` (ready), PR 2 en draft empilée jusqu'à fusion de la PR 1. |
| MTEKode accepte une PR vers sa branche | PR 1 vers `MTEKode:MTEKode/lsp-navigation` (diff propre, 6 commits) ; PR 2 après. |
| MTEKode préfère que PHP attende | Garder les branches, rebaser à la fusion. |
| **Pas de réponse au 2026-11-09** (une semaine) | Ouvrir l'issue 1, puis PR 1 en **draft** vers `stablyai/orca:main` avec la mention « Stacked on #24703 » ; repasser en ready après fusion + rebase. PR 2 seulement après validation Windows → WSL. |

Pourquoi draft sans réponse : le diff inclut les commits de #24703 tant qu'elle n'est pas fusionnée ; une PR ready ferait relire deux fois le même code. En draft, la CI ne lance qu'une sélection de tests unitaires.

## Vérifications complètes (2026-11-02)

| Contrôle | Résultat |
|---|---|
| `pnpm lint` (toutes étapes) | Vert sur nos fichiers. 2 échecs déjà présents sur `215cbee` : anti-slop `lsp-navigation-providers.ts:27` (code de #24703) et focus-read ratchet `worktree-creation-ready-toast.tsx`. Hors périmètre, non corrigés. |
| `pnpm build` | Desktop OK ; bundle web mobile non construit (dépendances `mobile/` absentes du clone). |
