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
