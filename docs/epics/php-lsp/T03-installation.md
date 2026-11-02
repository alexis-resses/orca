# T03 — Commandes d'installation / mise à jour des serveurs PHP

## Objectif
Que les boutons Install / Update de la ligne PHP lancent des commandes correctes dans le terminal intégré.

## Contexte
`installCommand` / `updateCommand` sont des chaînes du catalogue ; `language-server-install-command.ts` les préfixe d'un `cd` selon le shell (posix, PowerShell, cmd) et renvoie la commande brute dans un shell WSL. Le panneau d'install (`LanguageServerInstallPanel.tsx`) contient un commentaire spécifique Ruby (`.ruby-version`).

## À faire
1. Intelephense : `npm install -g intelephense` / `npm update -g intelephense`.
2. Phpactor : la méthode recommandée est le PHAR. Choisir une commande POSIX en une ligne (télécharger `phpactor.phar` depuis la dernière release GitHub vers `~/.local/bin/phpactor`, `chmod +x`). Pour l'update, la même commande. Documenter dans un commentaire « Why: » que Phpactor demande PHP 8.1+.
3. Si une commande n'a pas de sens sous PowerShell/cmd (cas du PHAR), le panneau doit l'indiquer plutôt que lancer une commande fausse : ajouter au catalogue un champ optionnel `installShells?: readonly ('posix' | 'powershell' | 'cmd')[]` et masquer le bouton sinon. Ne le faire que si c'est nécessaire.
4. Généraliser le commentaire Ruby du panneau (le `cd` sert aux shims de version de tout langage).
5. Tests de `language-server-install-command.test.ts` et de la section pour PHP.

## Fichiers à lire
- `src/renderer/src/components/settings/language-server-install-command.ts` et `.test.ts`
- `src/renderer/src/components/settings/LanguageServerInstallPanel.tsx`
- `src/shared/language-server-catalog.ts`
- Notes de sortie de T02

## Critères d'acceptation
- Install puis Update fonctionnent à la main pour Intelephense sur Windows natif (si Node installé).
- Aucun bouton n'affiche une commande inapplicable au shell courant.

## Commit
`feat(lsp): install and update commands for PHP language servers`
