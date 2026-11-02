# T00b — Messages pour l'amont (à publier par Alexis)

Rédigés à partir de la description de la PR #24703 et du README de l'EPIC. Le comportement WSL n'est pas encore vérifié (T06) : il est formulé comme une question.

## 1. Commentaire sur la PR #24703 (pour @MTEKode)

```markdown
Hi @MTEKode, thanks for this PR, the catalog and per-project settings make adding languages straightforward.

I'd like to build on it for two things I need daily:

1. **PHP**: add `phpactor` and `intelephense` to the catalog, with the same one-server-per-language model as `ruby-lsp` / `solargraph` (Phpactor first since it is MIT; Intelephense only detected if installed, never bundled). Navigation only, same allowlist.
2. **Repos inside WSL** opened from Orca on Windows: run the server inside the distro through `wsl.exe --exec` and map `file:` URIs between the `\\wsl.localhost\<distro>\...` paths Monaco sees and the Linux paths the server sees.

For (1), the settings section is currently written around Ruby (`RubyChoice`), so I would first make it generic, one row per language driven by the catalog, rather than copy it for PHP.

A few questions before I start:

- Are you planning other languages or WSL support yourself?
- Would you prefer PRs against your branch now, or separate PRs once this one is merged?
- The description says WSL repos report `unsupported-host`. Reading the code, I only found the execution-host check, and a WSL repo looks like a local repo with a UNC path. Is `unsupported-host` expected for WSL repos today, or does it come from somewhere I missed?
```

## 2. Commentaire sur l'issue #5247

```markdown
Another use case for this: PHP / Symfony projects that live inside WSL, opened from Orca on Windows. Reviewing agent changes means jumping into Symfony classes under `vendor/` all the time, and that only works with a PHP language server running where PHP is installed, inside the distro.

#24703 adds language-server navigation (TypeScript and Ruby, opt-in per project). I plan to follow up with PHP servers (Phpactor, Intelephense) and support for repos inside WSL, and have asked on that PR how the maintainers would like it split.
```
