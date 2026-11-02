# T00 — Mise en place du fork et baseline

## Objectif
Avoir un fork d'Orca qui build et dont les tests LSP passent, sur la branche `feat/php-lsp`, avec l'EPIC versionné dedans.

## Contexte
La plomberie LSP vient de la PR #24703, non fusionnée. On part de sa branche, pas de `main`. Poste : Windows + WSL ; Orca est buildé et lancé **côté Windows**.

## À faire
1. Forker `stablyai/orca`, ajouter le remote `mtekode` → `https://github.com/MTEKode/orca.git`, créer `feat/php-lsp` depuis `mtekode/MTEKode/lsp-navigation`. Noter le SHA de départ dans les notes de sortie.
2. Copier ce dossier dans `docs/epics/php-lsp/`.
3. `pnpm install`, `pnpm tc`, puis `pnpm test src/main/lsp src/renderer/src/lib/lsp src/shared/repo-language-server-settings.test.ts`.
4. Lancer Orca en dev (`pnpm dev`, le fork n'est jamais packagé ni installé), ouvrir un petit projet TypeScript **natif Windows** (pas dans WSL), activer le serveur TypeScript dans Réglages → projet → Language Servers, vérifier que `F12` sur un import ouvre l'autre fichier.
5. Vérifier que `CLAUDE.md` (qui importe `AGENTS.md`) suffit à `dev-commit` pour trouver le format de commit ; sinon ajouter une section « Commits » minimale dans un `CLAUDE.local.md` non versionné.

## Fichiers à lire
`AGENTS.md`, `CLAUDE.md`, `package.json` (scripts uniquement).

## Critères d'acceptation
- `pnpm tc` vert ; les tests LSP listés passent (ou les échecs préexistants sont listés dans les notes de sortie avec leur message).
- Navigation TypeScript vérifiée à la main sur Windows natif.
- `docs/epics/php-lsp/` commité.

## Commit
`docs(lsp): add PHP LSP epic plan`

## Notes de sortie

- SHA de départ : `215cbeef9b7dc8f61c4ea44b0356df75858b40ca` (`mtekode/MTEKode/lsp-navigation`). Remotes : `origin` = fork `alexis-resses/orca`, `upstream` = `stablyai/orca`, `mtekode` = `MTEKode/orca`.
- Écart : clone **dans WSL** (Ubuntu), pas sous Windows ; `pnpm tc` et vitest tournent dans WSL. Prérequis ajoutés : `build-essential` (node-pty), pnpm via corepack, `bun` 1.4.2 (`config/.bun-version`, exigé par `run-vitest.mjs`), PHP 8.5 dans la distro.
- `pnpm tc` vert ; tests LSP listés : 17 fichiers, 114 tests verts, aucun échec préexistant.
- `docs/**` est ignoré par le `.gitignore` d'Orca : le plan est ajouté avec `git add -f` (à retirer en T11, déjà prévu).
- `AGENTS.md` ne définit aucun format de commit : ajout d'un `CLAUDE.local.md` non versionné (exclu via `.git/info/exclude`) pour `dev-commit`.
- **En attente** : validation manuelle TypeScript sur Windows natif (étape 4), qui demande un clone Windows avec Node 24 et pnpm ; à faire au plus tard avant T03.
