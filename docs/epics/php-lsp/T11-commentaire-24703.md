# Relance sur la PR #24703 (à publier par Alexis)

Suite du commentaire 6575375881 (T00b). Constats vérifiés le 2026-11-02 : PR `mergeable_state: dirty` (conflit avec `main`), aucun check CI sur `215cbee`, et `pnpm lint` échoue sur son code (`lsp-navigation-providers.ts:27`, règle présente dans sa base, fichier non modifié par l'EPIC). Le texte ci-dessous se colle tel quel.

---

````markdown
Hi @MTEKode, a quick follow-up on my earlier comment.

The PHP and WSL work is done on my fork, built on top of this PR's head (`215cbee`):

- PHP (Phpactor + Intelephense, generic settings rows): https://github.com/alexis-resses/orca/compare/215cbee...feat/lsp-php
- Repositories inside WSL: https://github.com/alexis-resses/orca/compare/feat/lsp-php...feat/lsp-wsl

While running the full checks I noticed two things on this PR, in case they help it land:

1. **Merge conflict:** GitHub reports this branch as conflicting with `main`.
2. **Lint:** `pnpm lint` fails on `src/renderer/src/lib/lsp/lsp-navigation-providers.ts:27`:
   `anti-slop(no-object-parameters): Parameter 'extra' uses the broad 'object' type.`
   A named type for the two call sites should be enough, for example:

   ```ts
   type LocationRequestParams = {
     position: LspPosition
     context?: { includeDeclaration: boolean }
   }
   ```

   (The other full-lint failure I saw, the focus-read ratchet in `worktree-creation-ready-toast.tsx`, is unrelated to this PR.)

Unless you'd prefer otherwise, I'll open the PHP PR against `main` as a **draft stacked on this one** around November 9, clearly marked "review only the commits after `215cbee`", and rebase it once this PR merges. If you'd rather take it as a PR against your branch, or want me to hold off, just say so.
````
