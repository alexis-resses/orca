# T06 — Conception : serveurs de langage pour les repos WSL

Spike du 2026-11-02, exécuté **dans WSL** (distro `Ubuntu`, WSL 2) avec l'interop Windows (`wsl.exe`, `taskkill.exe`). Orca n'a pas été lancé sous Windows : le comportement actuel est **déduit du code, à confirmer à la main par Alexis** (§1). Les réponses de §3 de T06 s'appuient sur des expériences réelles (§2).

Numéros de ligne : état de `feat/php-lsp` au moment du spike.

## 1. Comportement actuel (déduit du code, à confirmer à la main par Alexis)

Cas : Orca Windows, repo `\\wsl.localhost\Ubuntu\home\me\proj`, Phpactor activé.

| Étape | Code | Résultat pour un repo WSL |
|-------|------|---------------------------|
| Représentation | `Repo.path` = chemin UNC ; `getRepoExecutionHostId` (`src/shared/execution-host.ts:193`) ne regarde que `executionHostId` / `connectionId` | `'local'`. WSL ne se voit qu'au chemin (`parseWslUncPath`, `src/shared/wsl-paths.ts:13`) |
| Probe | `probeRepoLanguageServers` (`src/main/lsp/lsp-probe.ts:59`) : `local` vaut vrai (`:63`), donc **jamais** `unsupported-host` (`:70`) | `probeExternal` (`:30`) cherche `phpactor` avec `resolveCommandOnLocalPath`, PATH **Windows** et cwd UNC (`:38`). Sur win32 la recherche passe d'abord par le cwd (`src/main/ipc/command-path-resolver.ts:221`), donc la racine du repo, puis le PATH Windows |
| Statut affiché | | Phpactor absent de Windows → **`missing`** (« non installé »), pas `unsupported-host`. La description de la PR #24703 est fausse sur ce point (constat de T00b confirmé par le code) |
| Acquire | `LspSessionManager.acquire` (`src/main/lsp/lsp-session-manager.ts:57`) : le garde d'hôte passe (`:64`), puis `resolveCommand` (`:126`) → `resolveLspServerCommand` (`src/main/lsp/lsp-server-command.ts:58`) renvoie `null` (`:83-85`) | `createEntry` renvoie `null` (`:134-135`) → **`fail('unavailable')`** (`:84-85`). Aucun process lancé |
| Si un binaire Windows existe | ex. `intelephense.cmd` installé par npm **Windows** | `spawnProcess` lance le binaire Windows avec `cwd` UNC (`src/main/lsp/lsp-session.ts:64-72`) et `rootUri = file://wsl.localhost/Ubuntu/...` (`:63`). Les deux côtés voient la même URI, donc ça marche sans traduction, mais lentement (indexation par 9P) et sans PHP pour Phpactor. Un shim `.cmd`/`.bat` lancé par `cmd.exe` avec un cwd UNC retombe sur `C:\Windows` |
| Serveur intégré (TypeScript) | branche `bundled` (`lsp-server-command.ts:65`) : node Windows + tsserver sur chemins UNC | Fonctionne déjà côté Windows. **À ne pas basculer dans WSL** |

**Constat bloquant hors WSL** : `LSP_LANGUAGE_IDS = ['typescript', 'javascript', 'ruby']` (`src/renderer/src/lib/lsp/lsp-document-sync.ts:4`) ne contient pas `php`. Un modèle PHP n'est donc jamais suivi (`:68`) et aucun `acquire` n'est émis, même pour un repo natif. Aucune tâche de la phase 1 ne le prévoit : à ajouter à T02, T05 ou une petite tâche dédiée (décision d'Alexis).

À constater à la main sur Windows : statut dans Réglages (`missing` attendu), absence de navigation, rien dans les logs `[lsp]` (aucune session créée).

## 2. Expériences (WSL → `wsl.exe` par interop)

Le `wsl.exe` Windows a été identifié par sa ligne de commande (`Get-CimInstance Win32_Process`, lecture seule) puis tué par `taskkill.exe /F /PID` (TerminateProcess, sans `/T`), ce que fait Orca sous Windows. Tous les process de test ont été nettoyés.

| # | Commande | Résultat |
|---|----------|----------|
| A1 | `wsl.exe -d Ubuntu --exec sleep 302`, puis `taskkill /F` du `wsl.exe` Windows de tête | `sleep` Linux **tué** (le `wsl.exe` de tête a un enfant `wsl.exe`, tous deux disparaissent) |
| A2 | `--exec sh -c 'sleep 303 & exec sleep 304'`, puis kill du `wsl.exe` de tête | **les deux** tués (même groupe de process) |
| A3 | `--exec sh -c 'setsid sleep 305 & exec sleep 306'`, puis kill | `sleep 306` tué, **`sleep 305` survit** (rattaché à PID 1). Nettoyé à la main |
| A4 | `wsl.exe -d Ubuntu --exec sh -c 'cat >/dev/null; echo EOF-seen'` avec stdin sur un FIFO, puis fermeture du FIFO | `EOF-seen`, `wsl.exe` sort avec le code 0 : **l'EOF de stdin traverse `wsl.exe`** |
| C1 | `wsl.exe -d Ubuntu --cd /tmp --exec pwd` | `/tmp` |
| C2 | `wsl.exe -d Ubuntu --cd '/tmp/no such dir' --exec pwd` | message `chdir(...) failed 2` sur stderr, puis **`/`, code de sortie 0** : `--cd` retombe en silence sur `/` |
| C3 | `--exec sh -c 'cd "$1" && exec pwd' sh /tmp` | `/tmp` |
| C4 | idem avec un dossier absent | `sh: cd: can't cd`, **code 2** |
| C5 | `--cd` et `sh -c cd` sur un dossier avec espace et accent | `pwd` correct dans les deux cas |
| P1 | `--exec sh -c 'echo "$PATH"'` (non-login) | PATH système + 20 entrées `/mnt/c/...` ; **ni `~/.local/bin` ni nvm** |
| P2 | `--exec bash -lc 'echo "$PATH"'` (login) | + `~/.local/bin`, `/snap/bin` ; **pas nvm** (chargé par `~/.bashrc`) |
| P3 | `--exec bash -ilc 'echo "$PATH"'` (login interactif) | + `~/.nvm/versions/node/v24.18.0/bin` : seul le shell interactif voit le npm global |
| P4 | `--exec sh -c 'cd "$1" \|\| exit 1; shift; exec "$@"' orca-wsl /tmp /usr/bin/env "PATH=<P3>" "HOME=…" sh -c 'pwd; command -v node; cat'` avec `hello-stdio` sur stdin | `/tmp`, node nvm trouvé, `hello-stdio` renvoyé **octet pour octet** : forme utilisée par `wsl-runner`, stdout propre |
| U1 | `URI.from({scheme:'file', authority:'wsl.localhost', path:'/Ubuntu/home/me/a b/é[1].php'}).toString()` (Monaco du repo, équivalent de `URI.file` UNC sur win32, cf. `uri.js` `static file`) | `file://wsl.localhost/Ubuntu/home/me/a%20b/%C3%A9%5B1%5D.php` |
| U2 | même chose avec `authority: 'wsl$'` | `file://wsl%24/Ubuntu/...` |
| U3 | `URI.parse('file://WSL.LOCALHOST/Ubuntu/x')` | autorité mise en minuscules, distro inchangée |
| U4 | `pathToFileURL(unc, { windows: true })` / `fileURLToPath(u, { windows: true })` (Node 24) | même encodage que Monaco sur ce cas ; aller-retour `\\wsl.localhost\Ubuntu\...` exact, `wsl%24` → `\\wsl$\...` |
| K1 | `kill -0 <PID Windows>` dans WSL (3 PID de `wsl.exe`) | aucun n'existe côté Linux |

Outillage du poste : `php` 8.5 présent dans la distro, **`composer` absent**, node/npm via nvm, Phpactor et Intelephense non installés.

## 3. Conception

### 3.1 Lancement

| Élément | Décision | Réutilise |
|---------|----------|-----------|
| Portée | Uniquement les serveurs `kind: 'external'` d'un repo dont `parseWslUncPath(rootPath)` renvoie une distro. Le serveur intégré TypeScript reste côté Windows, sans traduction | `parseWslUncPath` (`src/shared/wsl-paths.ts:13`) |
| Programme | `resolveWslExecutablePath()` | `src/main/wsl/wsl-executable-path.ts:7` |
| argv | `buildWslExecArgs(distro, guestArgv)` : toujours `--exec`, jamais `--` | `src/shared/wsl-login-shell-command.ts:18` |
| cwd Linux | **`sh -c 'cd "$1" \|\| exit 1; shift; exec "$@"'`**, pas `--cd` : `--cd` sur un dossier absent démarre en `/` avec le code 0 (C2), le serveur indexerait `/`. Le wrapper échoue franchement (C4) et `exec` garde un seul process | `withGuestCwd` (`src/main/wsl/wsl-runner.ts:155`) produit exactement cette forme |
| PATH | Login PATH **mis en cache** (`WslLoginPath` = `'preferred'`), appliqué par `env PATH=… HOME=… <programme>` : pas de shell interactif au lancement, donc pas de bannière sur stdout, le canal JSON-RPC reste propre (P4). Seul `bash -ilc` voit nvm (P3), ce que fait la sonde du cache. Si la sonde échoue, lancement avec le PATH par défaut (dégradé, comme le runner) | `getWslGuestEnvironment` (`src/main/wsl/wsl-guest-environment.ts:118`), `buildGuestArgv` (`wsl-runner.ts:181`) |
| cwd Windows | `resolveWslInteropSpawnCwd()`, jamais le cwd UNC | `src/main/wsl-interop-spawn-directory.ts:42` |
| env hôte | `process.env` + `WSL_UTF8=1` (sinon `wsl.exe` écrit ses erreurs en UTF-16LE) | `buildHostEnv` (`wsl-runner.ts:133`) |
| Spawn | `spawnProcess` de `@orca/process-host`, comme aujourd'hui | `lsp-session.ts:64` |
| `processId` | **`null`** dans `initialize` pour une session WSL : le PID Windows n'existe pas dans la distro (K1). Les serveurs basés sur `vscode-languageserver` (Intelephense) surveillent ce PID et s'arrêtent s'il est absent (connaissance de la bibliothèque, non vérifié ici faute de serveur installé) | `lsp-session.ts:158` |
| Options d'init | Non traduites : un chemin dans `initializationOptions` (ex. `storagePath` d'Intelephense, cache Phpactor) doit être un chemin **Linux** pour un repo WSL. À vérifier par T04 | |

argv final (Phpactor, repo `/home/me/proj`) :

```
C:\Windows\System32\wsl.exe -d Ubuntu --exec sh -c 'cd "$1" || exit 1; shift; exec "$@"' orca-wsl /home/me/proj /usr/bin/env PATH=<login PATH> HOME=/home/me phpactor language-server
```

**Réutilisation de `wsl-runner`** : `withGuestCwd`, `buildGuestArgv` et `buildHostEnv` sont privés et `runWslProcess` (`:201`) utilise `runProcess` (process court, sortie capturée). T08 doit **exporter** depuis `wsl-runner.ts` un constructeur de spawn, par exemple `buildWslSpawnCommand(spec: WslSpec): Promise<{ program; args; cwd; env; environmentResolved }>`, utilisé à la fois par `runWslProcess` et par la commande LSP. Ne pas recopier ces fonctions.

### 3.2 Arrêt

| Question | Réponse (expérience) | Décision |
|----------|----------------------|----------|
| Tuer `wsl.exe` tue-t-il le serveur Linux ? | **Oui**, y compris les enfants du même groupe (A1, A2) | Garder l'arrêt actuel tel quel : `shutdown` + `exit`, attente, puis `forceTerminateProcessTree` (`lsp-session.ts:125-153`, `:147`) |
| Exception | Un petit-enfant passé en `setsid` survit (A3) | Accepté : Phpactor et Intelephense ne font pas de démon connu. Si un serveur le faisait, c'est à lui de sortir sur EOF |
| Sortie sur EOF de stdin ? | L'EOF traverse `wsl.exe` (A4) | Couvre la mort brutale d'Orca : les pipes se ferment, le serveur reçoit EOF. Rien à ajouter. Qu'un serveur sorte bien sur EOF est à vérifier par serveur en T08/T10 |
| `killLeftoverGroup` | No-op sous win32 (`lsp-session.ts:263-266`) | Inchangé |

Conséquence : **T08 n'a pas de stratégie d'arrêt spécifique à coder**. Il ajoute seulement un test : `dispose` d'une session WSL (spawn factice) passe par le même chemin qu'en natif.

### 3.3 URI

**Forme exacte Monaco pour un fichier WSL** (sous Windows, `URI.file` sur le chemin UNC, puis `toEditorModelUri`, `src/renderer/src/components/editor/editor-model-uri.ts:15`) :

```
file://wsl.localhost/Ubuntu/home/me/proj/src/Kernel.php
file://wsl.localhost/Ubuntu/home/me/a%20b/%C3%A9.php   (encodage Monaco)
file://wsl%24/Ubuntu/home/me/proj/src/Kernel.php        (repo ouvert en \\wsl$\)
...#<ownerKey>                                           (fragment possible, à conserver)
```

L'autorité est mise en minuscules, la distro garde la casse du chemin (U1-U3). Côté serveur : `file:///home/me/proj/src/Kernel.php`.

**Où traduire** : à la **frontière d'E/S de `LspSession`**, pas dans le routeur. `toServer` enveloppe l'écrivain (`lsp-session.ts:73-76`), `toClient` s'applique dans `onServerMessage` avant `router.fromServer` (`:204-208`). Le routeur (`src/main/lsp/lsp-message-router.ts`) ne voit que des URI client : le suivi des documents (`:178`), les `didClose` de `detachPort` (`:158`), la réponse `workspace/workspaceFolders` (`:213`) et l'`initialize` interne passent tous par l'écrivain, donc sont traduits sans toucher au routeur.

**Traduction par nom de clé, sans regarder la méthode** : parcours profond du message (copie), une chaîne `file:` sous une clé de la liste est réécrite, le reste (dont `text`, `contents`) est intact. Une réponse ne porte pas sa méthode dans le routeur ; la clé suffit, la liste est bornée par l'allowlist.

Champs **client → serveur** (`toServer`, clés `uri`, `rootUri`) :

| Message | Champ |
|---------|-------|
| `initialize` (interne, `lsp-session.ts:157-160`) | `rootUri`, `workspaceFolders[].uri` (pas de `rootPath` envoyé) |
| `textDocument/didOpen`, `didChange`, `didClose` (dont celui de `detachPort`) | `textDocument.uri` |
| `textDocument/definition`, `references`, `hover`, `semanticTokens/full` | `textDocument.uri` |
| `workspace/symbol` | aucun (`query`) |
| Réponse du routeur à `workspace/workspaceFolders` | `result[].uri` |
| Réponse à `workspace/configuration` | aucune URI (tableau de `null`, `:209-212`) |

Champs **serveur → client** (`toClient`, clés `uri`, `targetUri`, `scopeUri`) :

| Message | Champ |
|---------|-------|
| `textDocument/definition` | `Location.uri`, `Location[].uri`, `LocationLink[].targetUri` |
| `textDocument/references` | `Location[].uri` |
| `workspace/symbol` | `SymbolInformation[].location.uri`, `WorkspaceSymbol[].location.uri` (avec ou sans `range`) |
| Requête serveur `workspace/configuration` | `params.items[].scopeUri` (inutile aujourd'hui, le routeur répond `null`, mais sans risque) |
| `textDocument/hover` | aucun champ ; un lien `file:///home/...` dans le Markdown reste tel quel (hors périmètre) |
| `semanticTokens/full`, réponse `initialize` | aucun |
| Notifications serveur (`publishDiagnostics`…) | jetées par le routeur (`:113-114`), rien à traduire |

Règles de conversion :

| Sens | Entrée | Sortie |
|------|--------|--------|
| toServer | UNC de **la** distro du repo (comparaison sans casse, `wsl.localhost` ou `wsl$`) | chemin Linux (`parseWslUncPath(...).linuxPath`) |
| toServer | chemin lecteur `C:\...` | `/mnt/c/...` (branche lecteur de `toLinuxPath`, `wsl-paths.ts:47`) |
| toServer | UNC d'une **autre** distro, URI non `file:` | inchangée |
| toClient | chemin Linux sous la racine du repo | UNC **avec le partage et la casse de distro de `rootPath`** (sinon `\\wsl$` vs `\\wsl.localhost` ou `Ubuntu` vs `ubuntu` donnent un autre modèle, donc un onglet en double) |
| toClient | `/mnt/<x>/...` hors racine | lecteur `X:\...` (`toWindowsWslDrivePath`, `wsl-paths.ts:161`) |
| toClient | autre chemin Linux (stubs Intelephense, `~/.config/...`) | UNC de la distro (`toWindowsWslUncPath`, `wsl-paths.ts:71`) |
| les deux | `?query` / `#fragment` | conservés tels quels |

Pièges pour T07 :
- `toLinuxPath` ne traite l'UNC **que sous win32** (`wsl-paths.ts:50`) : les tests tournent sous Linux en CI, donc appeler `parseWslUncPath` directement pour l'UNC.
- `pathToFileURL` / `fileURLToPath` avec `{ windows: true | false }` explicite (Node ≥ 22, Electron 43 OK) pour un résultat indépendant de la plateforme de test.
- L'encodage Node et l'encodage Monaco diffèrent sur certains caractères (`!`, `'`, `(`…) : sans effet, le renderer repasse par `Uri.parse(...).fsPath` puis `toEditorModelUri` (`src/renderer/src/lib/lsp/lsp-location-models.ts:53`, `:98`). Les tests comparent donc des chemins décodés, pas les chaînes.

### 3.4 Probe et installation

| Point | Décision | Réutilise |
|-------|----------|-----------|
| Détection | `runWslProcess({ distro, program: name, args: [...args, ...versionArgs], cwd: linuxRoot, loginPath: 'preferred', timeoutMs: 10_000, maxOutputBytes: 64 * 1024 })`, uniquement si le serveur est activé (comme `lsp-probe.ts:71`) | `runWslProcess` (`wsl-runner.ts:201`) |
| Fence stdout | **Inutile** pour la version : avec `'preferred'` la commande tourne sans shell interactif (`env PATH=…`). Le fence (`buildWslCapturedLoginShellCommand`) est déjà dans la sonde du cache | `wsl-guest-environment.ts` |
| Verdict | code 0 → `installed` + 1re ligne de stdout ; sinon `missing`. Si `environmentResolved === false`, un binaire nvm peut être vu absent à tort (P1) : pas de nouveau statut en V1 (YAGNI), un rafraîchissement suffit (le cache réessaie après 5 s) | `WslResult.environmentResolved` (`wsl-runner.ts:90`) |
| Override de commande | `program` passe par `assertNotShellString` (refus de `;`, `$`, `=`…) : un override en chaîne shell est refusé, c'est voulu | `wsl-runner.ts` |
| Installation | Le builder renvoie la commande brute seulement si le shell effectif est un shell WSL (`isWslShellName`, `src/renderer/src/components/settings/language-server-install-command.ts:25`). Sinon (PowerShell par défaut sous Windows) il fait `Set-Location \\wsl.localhost\...; composer ...`, donc lance **composer Windows**. T09b doit forcer un terminal WSL **de la distro du repo** et y faire `cd` au chemin Linux | |
| Poste d'Alexis | `composer` absent de la distro : `composer global require phpactor/phpactor` échouera, et `~/.config/composer/vendor/bin` n'est pas dans le PATH de login. À traiter en T03/T10 (doc ou commande d'install alternative) | |

## 4. Impact sur les tâches suivantes

| Tâche | Ajustement |
|-------|-----------|
| T07 | Signature `createWslUriMapper(rootPath)` → `WslUriMapper \| null` (garde le partage et la casse de `rootPath`) ; traduction par clés (listes du §3.3) ; pièges `toLinuxPath` et `{ windows }` |
| T08 | `ResolvedLspCommand` gagne `cwd?: string` (cwd Windows) et `ResolvedLspServer` gagne `wsl?: { distro; linuxRoot }` ; export d'un constructeur de spawn depuis `wsl-runner.ts` ; probe via `runWslProcess`, sans fence ; pas de stratégie d'arrêt à coder ; bundled exclu |
| T09a | Mapper appliqué dans `LspSession` (écrivain et lecteur), **routeur inchangé** ; `processId: null` ; cwd depuis `command.cwd` ; `lsp-session-manager.ts` transmet `resolved.wsl` à la session |
| T09b | Terminal d'install WSL forcé sur la distro du repo ; composer absent du poste |
| Hors WSL | `php` absent de `LSP_LANGUAGE_IDS` (§1) |
