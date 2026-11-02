# T09b — Réglages actifs pour les repos WSL et validation de bout en bout

## Objectif
Activer et utiliser un serveur PHP depuis les réglages d'un repo WSL, et vérifier la navigation dans l'éditeur.

## À faire
1. Réglages (`RepositoryLanguageServersSection` et le composant de T02) : un repo WSL est `local`, vérifier que rien ne le désactive ; afficher la distro à côté du statut si c'est simple.
2. Install / Update : le builder ne renvoie la commande brute que si le shell effectif est déjà WSL (`isWslShellName`) ; avec PowerShell par défaut il lance le composer/npm **Windows** (T06 §3.4). Forcer un terminal WSL de la distro du repo, `cd` au chemin Linux, puis la commande.
   Sur le poste d'Alexis, `composer` est absent de la distro et `~/.config/composer/vendor/bin` hors du PATH de login : prévoir le message ou la doc.
3. Validation manuelle : repo PHP dans WSL, Orca Windows, Phpactor puis Intelephense : `F12`, `Shift+F12`, hover ; l'ouverture cross-fichiers ouvre l'onglet Orca du fichier UNC.

## Fichiers à lire
- Notes de sortie de T09a
- `src/renderer/src/components/settings/RepositoryLanguageServersSection.tsx` et le composant de ligne créé en T02
- `src/renderer/src/components/settings/LanguageServerInstallPanel.tsx` et `language-server-install-command.ts`
- `docs/epics/php-lsp/T06-conception-wsl.md` §3.4

## Critères d'acceptation
- Les trois gestes fonctionnent avec les deux serveurs sur un repo WSL.
- Tests existants verts, `check:code-quality:changed` vert.

## Commit
`feat(lsp): enable language server settings for WSL repositories`
