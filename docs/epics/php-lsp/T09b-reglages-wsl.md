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

## Notes de sortie

- Fait : rien ne désactivait la section pour un repo WSL (`isLocal` vrai : repo UNC = hôte `local`), vérifié par test. Distro non affichée à côté du statut (nouvelle chaîne i18n x6 jugée non triviale ; la distro est dans le chemin du repo).
- Shell WSL de la bonne distro : `OnboardingInlineCommandTerminal` gagne `cwdOverride` ; `LanguageServerInstallPanel` passe `cwdOverride = repo.path` (UNC) et `shellOverride = 'wsl.exe'` pour un repo WSL. `createLocalPtyLaunchPlan` détecte le cwd UNC (`parseWslPath`) et lance `wsl.exe` dans la distro du chemin, au dossier Linux ; aucun code main modifié. Le builder répond en plus `cd -- <chemin Linux> && commande` pour tout repo UNC WSL, quelle que soit la famille de shell.
- Bouton Phpactor : `resolveInstallShell(repoPath, shell)` renvoie `wsl.exe` pour un repo WSL, donc la famille effective est posix et le bouton Install/Update apparaît même avec PowerShell par défaut. Repos natifs, Ruby et Intelephense inchangés (tests). Tests : +2 (builder), +3 (section), 1681 verts sur `components/settings` + `onboarding`.
- Non fait : `composer` absent de la distro d'Alexis ne concerne plus Phpactor (PHAR via curl, T03) ; `curl` et PHP 8.1+ requis dans la distro, `~/.local/bin` doit être dans le PATH de login pour la sonde.
- Validation manuelle impossible ici (Orca non lancé sous Windows). Check-list pour Alexis (Orca `pnpm dev` sous Windows, repo `\\wsl.localhost\<distro>\...`, PowerShell comme shell par défaut) :
  1. Réglages du repo : la section Language Servers est active (liste PHP non grisée).
  2. PHP = Phpactor, absent : le bouton Install est visible, pas le message « POSIX shell ». Clic : le terminal est un shell de la distro du repo (`uname -a` = Linux, `pwd` = dossier du repo), le PHAR s'installe dans `~/.local/bin`, le statut passe à installé. Tester aussi Update.
  3. Même chose avec Intelephense (npm de la distro, `which npm` sous Linux).
  4. Dans un fichier `.php` du repo, avec chaque serveur : `F12`/Ctrl+clic ouvre le bon fichier (y compris `vendor/`) dans un onglet Orca portant le chemin UNC ; `Shift+F12` liste les usages ; le survol affiche la signature.
  5. Non-régression : repo Windows natif (Ruby/TypeScript) et Ruby sous PowerShell se comportent comme avant ; liens `file:///home/...` du hover non traduits (connu, hors périmètre).
