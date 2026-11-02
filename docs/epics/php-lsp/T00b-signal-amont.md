# T00b — Signal en amont

## Objectif
Prévenir l'amont avant d'investir, pour savoir si PHP et WSL sont attendus, déjà en cours, ou à faire autrement.

## À faire
1. Rédiger (sans les publier : Alexis les poste lui-même) :
   - un commentaire sur la PR #24703 pour MTEKode : intention d'ajouter Phpactor et Intelephense sur son catalogue, et le support des repos WSL ; demander s'il prévoit lui-même d'autres langages ou WSL, et s'il préfère des PR sur sa branche ou après fusion ;
   - un commentaire sur l'issue #5247 : cas d'usage PHP/Symfony dans WSL, lien vers la #24703.
2. Inclure le constat de T00/T06 sur WSL seulement s'il est déjà vérifié (sinon le formuler comme une question).
3. Ton : court, factuel, en anglais, sans promesse de délai.

## Fichiers à lire
README de l'EPIC (sections « Décisions » et « Constats »), `AGENTS.md` (section « Writing Pull Requests », pour le ton).

## Critères d'acceptation
- Deux textes prêts à copier dans `docs/epics/php-lsp/T00b-messages.md`.
- Après publication par Alexis : réponses éventuelles résumées dans les notes de sortie ; si elles changent une décision, mettre à jour le README avant T01.

## Commit
`docs(lsp): upstream coordination notes`

## Notes de sortie

- Deux textes prêts dans `T00b-messages.md` (anglais, courts, sans délai promis), à publier par Alexis.
- Contradiction relevée : la description de la PR #24703 annonce `unsupported-host` pour WSL, mais le code (`lsp-probe.ts:63`, `lsp-session-manager.ts:64`) ne teste que `getRepoExecutionHostId(repo) !== 'local'`, et `execution-host.ts` n'a que les types `local` / `ssh` / `runtime` (WSL = `local` + `wslDistro`). Posée comme question à MTEKode ; le comportement réel reste à constater en T06.
- Publiés le 2026-11-02 : [PR #24703](https://github.com/stablyai/orca/pull/24703#issuecomment-6575375881), [issue #5247](https://github.com/stablyai/orca/issues/5247#issuecomment-6575376317).
- **En attente** : résumé des réponses ici ; mettre à jour le README si une décision change (D6 notamment : PR sur sa branche ou après fusion).
