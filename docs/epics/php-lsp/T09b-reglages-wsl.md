# T09b — Réglages actifs pour les repos WSL et validation de bout en bout

## Objectif
Activer et utiliser un serveur PHP depuis les réglages d'un repo WSL, et vérifier la navigation dans l'éditeur.

## À faire
1. Réglages (`RepositoryLanguageServersSection` et le composant de T02) : un repo WSL est `local`, vérifier que rien ne le désactive ; afficher la distro à côté du statut si c'est simple.
2. Install / Update : vérifier que le terminal ouvert est un shell WSL de la bonne distro (le builder renvoie alors la commande brute) ; sinon le corriger.
3. Validation manuelle : repo PHP dans WSL, Orca Windows, Phpactor puis Intelephense : `F12`, `Shift+F12`, hover ; l'ouverture cross-fichiers ouvre l'onglet Orca du fichier UNC.

## Fichiers à lire
- Notes de sortie de T09a
- `src/renderer/src/components/settings/RepositoryLanguageServersSection.tsx` et le composant de ligne créé en T02
- `src/renderer/src/components/settings/LanguageServerInstallPanel.tsx`

## Critères d'acceptation
- Les trois gestes fonctionnent avec les deux serveurs sur un repo WSL.
- Tests existants verts, `check:code-quality:changed` vert.

## Commit
`feat(lsp): enable language server settings for WSL repositories`
