# T10 — Résultats de validation

## 2026-11-02 — Orca Linux (WSLg), repos dans la distro (phase 1, PHP natif)

- Contexte : Orca dev lancé **dans WSL** (Ubuntu, `pnpm dev`, fenêtre via WSLg), projets sur le disque Linux : `~/php-lsp-test` (fixture Composer) et `~/php-lsp-legacy-test` (fixture legacy). Phpactor 2026.10.07.0, Intelephense 1.18.5.
- Verdict d'Alexis après essai manuel : « ça me paraît ok » (F12, Shift+F12, survol, réglages ; détail par geste non relevé).
- **Ne couvre pas** la phase 2 (Orca Windows → repo `\\wsl.localhost\...`) ni les projets publics Symfony / legacy de T10 : restent à faire.
