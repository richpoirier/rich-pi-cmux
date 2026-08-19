# rich-pi-cmux

<img width="1335" height="758" alt="Screenshot 2026-05-27 at 12 05 46" src="https://github.com/user-attachments/assets/27806213-60f9-4c30-84d4-4a331ea1484b" />

[![CI](https://github.com/richpoirier/rich-pi-cmux/actions/workflows/ci.yml/badge.svg)](https://github.com/richpoirier/rich-pi-cmux/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)

`rich-pi-cmux` is Richard Poirier's maintained fork of [pi-cmux](https://github.com/javiermolinar/pi-cmux).

It adds [cmux](https://www.cmux.dev)-powered terminal integrations for [Pi](https://pi.dev).

## What it adds

`rich-pi-cmux` keeps Pi terminal-native. It delegates notifications, sidebar status, pane splits, tab names, directory jumps, review handoff, and continuation workflows to cmux.

## Install

```bash
pi install git:github.com/richpoirier/rich-pi-cmux
```

You can also install a local checkout:

```bash
pi install /path/to/rich-pi-cmux
```

Pi 0.80.5 or later is required.

If Pi is already running:

```text
/reload
```

## Commands

| Workflow | Commands | Summary |
|---|---|---|
| Notifications | automatic | Sends `cmux notify` after Pi fully settles with a wait, completion, or error state. |
| Sidebar status/log | automatic | Updates live cmux state, then shows the final state after Pi fully settles. |
| Split Pi | `/cmv [prompt]`, `/cmh [prompt]` | Opens a new right/lower split with Pi in the same project. |
| Run a tool | `/cmo <cmd>`, `/cmoh <cmd>`, `/cmt <cmd>` | Opens a split or tab and runs a shell command in the same project. |
| Pluggable tools | custom `/<name>` | Registers cmux split shortcuts from `rich-pi-cmux.commands` settings. |
| Jump directory | `/cmz <query>`, `/cmzh <query>` | Resolves a zoxide match or path, then opens Pi there. |
| Continue task | `/cmcv [note]`, `/cmch [note]` | Opens a related handoff session in a split. |
| Continue in worktree | `/cmcv -c <branch> [--from <ref>] [note]` | Creates a branch worktree and starts Pi there with handoff context. |
| Review in split | `/cmrv [flags] [target]`, `/cmrh [flags] [target]` | Starts a focused review session in a split. |

Detailed command examples: [docs/usage.md](docs/usage.md).

## Common examples

```text
/cmv Review the auth flow
/cmo npm test
/cmt k9s
/cmz mono
/cmcv focus on tests
/cmcv -c fix/sidebar --from main
/cmrv --bugs src/auth.ts
/cmrv https://github.com/owner/repo/pull/123
```

## Configuration

| Variable | Default | Purpose |
|---|---:|---|
| `PI_CMUX_NOTIFY_LEVEL` | `all` | `all`, `medium`, `low`, or `disabled`. |
| `PI_CMUX_NOTIFY_INCLUDE_RESPONSE` | `0` | Append truncated final assistant response to non-error notifications. |
| `PI_CMUX_NOTIFY_THRESHOLD_MS` | `15000` | Duration threshold for `Task Complete` vs `Waiting`. |
| `PI_CMUX_SIDEBAR` | `1` | Set `0` to disable sidebar integration. |
| `PI_CMUX_SIDEBAR_FLASH` | `all` | `all`, `error`, or `disabled`. |
| `PI_CMUX_SIDEBAR_TOKENS` | `1` | Include compact cumulative session token counts in final sidebar summaries. |
| `PI_CMUX_SIDEBAR_COST` | `0` | Include reported model cost alongside token counts. |
| `PI_CMUX_SIDEBAR_LOG_TOOLS` | `0` | Set `1` to log every tool result. |

Register custom split shortcuts under `rich-pi-cmux.commands` in `~/.pi/agent/settings.json` or `.pi/settings.json`. See [docs/usage.md](docs/usage.md#pluggable-tool-commands).

Example Hunk review shortcut:

```json
{
  "rich-pi-cmux": {
    "commands": {
      "ck": {
        "run": "hunk diff --agent-notes --watch",
        "acceptArgs": true,
        "description": "Open Hunk diff with agent notes in a cmux split"
      }
    }
  }
}
```

Use `/ck` to open Hunk in a cmux split, add Hunk comments while reviewing, then ask Pi to read them.

`rich-pi-cmux` also exposes an agent tool for requested terminal commands. Pi can open `k9s` in a cmux tab without shell capture.

cmux workspace/surface targeting uses `CMUX_WORKSPACE_ID` and `CMUX_SURFACE_ID` automatically. Sidebar integration only activates inside a cmux workspace.

## Bundled resources

Extensions: `cmux-notify`, `cmux-sidebar`, `cmux-split`, `cmux-open`, `cmux-zoxide`, `cmux-review`, `cmux-continue`.

`rich-pi-cmux` does not bundle generic review skills or prompt templates. Other packages can own `/review`, `/review-diff`, and `code-review` without conflicts.
