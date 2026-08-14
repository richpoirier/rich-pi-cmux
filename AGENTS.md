# AGENTS.md

## Repo overview

This repository contains `rich-pi-cmux`, Richard Poirier's maintained fork of `pi-cmux`.

Current extensions:
- `extensions/cmux-notify.ts`: sends `cmux notify` alerts after Pi fully settles in a wait, completion, error, or abort state
- `extensions/cmux-split.ts` — adds split commands that open a new cmux pane and start a fresh Pi session in the same working directory
- `extensions/cmux-zoxide.ts` — adds zoxide-based split commands that jump to a matched directory and start Pi there

Other important files:
- `README.md` — user-facing package documentation
- `CHANGELOG.md` — unreleased and released changes
- `install.mjs` — installer/removal entrypoint used by `npx rich-pi-cmux`
- `package.json` — package metadata for npm and Pi

## How the repo works

- This TypeScript package uses a local TypeScript dev dependency and Node's test runner.
- Extensions are loaded from `./extensions` via the `pi.extensions` entry in `package.json`.
- Install the package through GitHub or a local path until an npm release exists.

## Editing guidelines

- Keep README examples and behavior descriptions aligned with the extension behavior.
- Update `CHANGELOG.md` for user-visible changes.
- Prefer small, focused edits.
- Preserve the existing style: concise docs, simple utilities, minimal dependencies.
- Keep the existing `PI_CMUX_*` variables and `/cm*` commands compatible.

## Release / push checklist

Before pushing changes:
- bump the npm version
- update `CHANGELOG.md` if behavior changed
- make sure `README.md` matches the current behavior
- review the git diff for accidental changes

## Notes for future agents

- Run `npm run typecheck` with the repository's local TypeScript dependency.
- If you change publishable package metadata or release behavior, check `package.json`, `README.md`, and `CHANGELOG.md` together.
