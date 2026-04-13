# codex-team

`codex-team` is a small CLI for managing multiple Codex ChatGPT login snapshots on one machine.

It stores named snapshots under `~/.codex-team/`, lets you switch the active `~/.codex/auth.json`, and can cache quota usage including 5-hour and weekly window status.

## Install

```bash
npm install -g codex-team
```

After install, use the `codexm` command.

## Quick start

```bash
npm install -g codex-team
codexm add plus1
codexm add team1
codexm launch --watch
```

`codexm add` opens a login flow and stores each account as a named snapshot. `codexm launch --watch` starts Codex Desktop and keeps a background watcher running so quota exhaustion can switch to the best available saved account.

## Shell completion

Generate a shell completion script and install it with your shell's standard mechanism:

```bash
mkdir -p ~/.zsh/completions
codexm completion zsh > ~/.zsh/completions/_codexm
mkdir -p ~/.local/share/bash-completion/completions
codexm completion bash > ~/.local/share/bash-completion/completions/codexm
```

The generated scripts dynamically complete saved account names by calling `codexm completion --accounts`.

## Commands

```bash
codexm --version
codexm completion <zsh|bash>
codexm current [--refresh] [--json]
codexm list [name] [--verbose] [--json]
codexm add <name> [--device-auth|--with-api-key] [--force] [--json]
codexm save <name> [--force] [--json]
codexm update [--json]
codexm switch <name> [--force] [--json]
codexm switch --auto --dry-run [--force] [--json]
codexm launch [name] [--auto] [--watch] [--no-auto-switch] [--json]
codexm watch [--no-auto-switch] [--detach] [--status] [--stop]
codexm remove <name> --yes [--json]
codexm rename <old> <new> [--json]
```

Global flags: `--help`, `--version`, `--debug`

Use `--json` for machine-readable output and `--debug` for stderr diagnostics.

### Account management

- `codexm add <name>` creates a new managed account without changing the active `~/.codex/auth.json`. By default it uses the built-in browser ChatGPT login flow; add `--device-auth` for device-code login on remote/headless machines. `--with-api-key` reads an API key from stdin, for example `printenv OPENAI_API_KEY | codexm add work-api --with-api-key`.
- `codexm current` shows the active account. Add `--refresh` to include current quota usage.
- `codexm list` refreshes saved accounts before printing, shows which row is current with `*`, and summarizes availability, score, ETA, usage, and reset times. Add `--verbose` for more quota detail. In the default table, unavailable accounts use a red row background, low remaining quota values use bold yellow/red text, and reset times within one hour get a cyan `(Xm)` suffix.

### Desktop mode

- `codexm launch` starts Codex Desktop with current auth, switches first when you pass a saved account name, or picks the best saved account with `codexm launch --auto`. Add `--watch` to keep a detached watcher running after launch. Run `codexm launch` from an external terminal if you need to restart Desktop.
- `codexm switch`, `codexm switch --auto`, and auth-changing `codexm launch` only let one auth-changing operation run at a time. If another switch is already in progress, the CLI tells you and asks you to retry later.
- `codexm switch --force` and `codexm switch --auto --force` try to apply the auth change to the running managed Desktop immediately. If that fails, codexm closes the managed Desktop so it does not keep running on the old account.
- `codexm watch` watches the managed Codex Desktop session, prints quota updates, and by default auto-switches when the active account is exhausted. Use `--no-auto-switch` for read-only watching. `--detach` runs it in the background; use `--status` and `--stop` to inspect or stop it.

Unknown commands and flags fail fast; when there is a close match, `codexm` suggests it.

## Typical flow

1. Add target accounts with `codexm add <name>` or save the currently active Codex auth with `codexm save <name>`.
2. Repeat for other accounts.
3. Switch between saved accounts with `codexm switch <name>`, let the tool choose with `codexm switch --auto`, or start Desktop on the best candidate with `codexm launch --auto --watch`.
4. Refresh and inspect quota usage with `codexm list`.

For ChatGPT auth snapshots, `codex-team` can save and switch different users under the same ChatGPT account/workspace as separate managed entries when the local login tokens distinguish them.

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## License

MIT
