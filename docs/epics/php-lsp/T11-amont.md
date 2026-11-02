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
