# T02 — Écran de réglages générique piloté par le catalogue

## Objectif
Remplacer le sélecteur Ruby codé en dur par une ligne par langage, générée depuis le catalogue, et y faire apparaître PHP.

## Contexte
`RepositoryLanguageServersSection.tsx` (≈260 lignes) contient `type RubyChoice = 'off' | 'ruby-lsp' | 'solargraph'`, un `Select` Ruby écrit à la main, le statut, le bouton Install/Update et le champ de commande. Ajouter PHP en copiant violerait « Reuse Before Reimplementing » et la limite de lignes.

## À faire
1. Dériver depuis le catalogue la liste des « langages configurables » : pour chaque groupe `languageIds`, les serveurs externes candidats. TypeScript (bundled) garde son interrupteur actuel.
2. Extraire un composant `LanguageServerChoiceRow` (nom à ajuster, pas de `utils`) : label du langage, `Select` (`off` + serveurs du groupe), statut, Install/Update, champ de commande. Il remplace le bloc Ruby.
3. `setEnabled` doit mettre à `false` les autres serveurs du même langage (comportement actuel de Ruby, généralisé).
4. Libellé « PHP » dans les 6 locales (clé à côté de la clé `ruby` existante) ; ajouter à `en-runtime-required.json` si la clé Ruby y est.
5. Mettre à jour la recherche dans les réglages (`repository-language-servers-search-entries.ts`) pour inclure PHP.
6. Tests : le test existant de la section passe toujours pour Ruby ; ajouter un cas PHP (choix Phpactor, bascule vers Intelephense, retour à off).

## Fichiers à lire
- `src/renderer/src/components/settings/RepositoryLanguageServersSection.tsx` et `.test.tsx`
- `src/renderer/src/components/settings/repository-language-servers-search-entries.ts` et `.test.ts`
- `src/shared/language-server-catalog.ts`
- `docs/STYLEGUIDE.md` (sections formulaires/settings uniquement)
- `src/renderer/src/i18n/locales/fr.json` (repérer la clé `ruby` voisine, puis les 5 autres locales au même endroit)

## Critères d'acceptation
- Aucun `RubyChoice` ni nom de serveur codé en dur dans le composant.
- Ruby se comporte exactement comme avant (tests existants inchangés et verts).
- PHP visible et activable ; `pnpm run check:code-quality:changed` vert (aucune couleur brute, primitives `components/ui/`).

## Commit
`refactor(lsp): drive language server settings rows from the catalog`
