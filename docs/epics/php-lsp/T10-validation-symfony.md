# T10 — Validation manuelle sur un projet Symfony et un projet PHP legacy (publics)

## Objectif
Valider l'EPIC sur deux vrais projets et mesurer ce qui compte au quotidien :
- **Symfony** : un projet public avec un `vendor/` conséquent (par exemple `symfony/demo`), cloné dans WSL ;
- **PHP legacy** : un projet open source en PHP natif, sans framework, de préférence sans Composer et avec des `require` à la main (à choisir au début de la tâche et à noter ici), cloné dans WSL.

Ces projets sont publics à dessein : l'EPIC se fait sur un poste et un compte personnels. Une validation sur des projets professionnels est hors EPIC.

Préciser pour chacun s'il est dans WSL ou sur le disque Windows.

## À faire — projet Symfony
Pour Phpactor puis Intelephense :
1. Temps entre l'activation et la première réponse `F12` (indexation initiale), puis temps d'une réponse à chaud.
2. `Ctrl+clic` sur : une classe de `src/`, une méthode héritée, une interface implémentée, un service Symfony de `vendor/`, une fonction globale PHP.
3. `Shift+F12` sur une méthode utilisée dans plusieurs fichiers (plafond de 100 fichiers en aperçu, voir PR #24703).
4. Hover sur une méthode documentée.
5. Mémoire / CPU du serveur dans WSL pendant l'indexation (`top` dans la distro).
6. Fermer le projet / quitter Orca : le serveur Linux a-t-il bien disparu (`ps` dans la distro) ?

## À faire — projet PHP legacy
Pour Phpactor puis Intelephense :
1. Temps d'indexation initiale et réponse à chaud, comme pour le projet Symfony.
2. `Ctrl+clic` sur : une fonction globale définie dans un fichier inclus, une classe instanciée après un `require_once`, une méthode d'un objet retourné par une autre méthode (avec et sans `@return`), une constante `define`.
3. `Shift+F12` sur une fonction globale très utilisée.
4. Noter les appels dynamiques fréquents dans le projet (`$obj->$method()`, `call_user_func`, `new $class`) : non résolus par conception, mais utiles pour estimer le confort réel.
5. Comparer avec le tableau « cas legacy × serveur » de T05.

## À faire — plusieurs worktrees
Lancer 3 agents en parallèle sur le projet Symfony (3 worktrees), ouvrir un fichier PHP dans chacun : mesurer la mémoire totale des serveurs dans WSL et vérifier que la limite de 3 sessions et l'éviction fonctionnent.

## Synthèse
Consigner un tableau des résultats dans `docs/epics/php-lsp/T10-resultats.md`, avec les bugs trouvés. Un bug bloquant ouvre une tâche `T10b`.

## Critères d'acceptation
- Tableau rempli pour les deux serveurs **et les deux projets** ; aucun processus orphelin.
- Recommandation finale par type de projet : serveur par défaut pour Symfony, serveur par défaut pour PHP natif (Orca garde un réglage par projet, donc les deux peuvent différer).

## Commit
`docs(lsp): PHP LSP validation results on Symfony and legacy PHP projects`
