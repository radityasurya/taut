# Contributing

Thanks for helping. tautan is small and opinionated; this page tells you how to fit in.

## Setup

1. Install [Bun](https://bun.sh) 1.2+ and [pnpm](https://pnpm.io).
2. Install [herdr](https://herdr.dev) and start a session. tmux is optional.
3. Run `make dev`. It installs dependencies on first run, frees the ports, starts the Hub
   and Vite, maps `tailscale serve`, and prints the local and tailnet URLs.
4. Open the tailnet URL on the phone. `make stop` cleans up.
5. On a desktop browser the dev build shows the Agentation overlay: annotate any element and
   the note reaches Claude Code through the MCP server in `.mcp.json` (start it once with
   `claude mcp list` to confirm it is registered). The overlay never ships in a build.

## Before you write code

- Read `CONTEXT.md` and use its vocabulary in code, docs, and commit messages.
- Read `docs/ROADMAP.md`. Work belongs to a phase; pick the current one or an item marked "later".
- Read `docs/ARCHITECTURE.md` for the design and `docs/adr/` for the two decisions that
  are not up for casual change.

## Rules

- **Never send input to a multiplexer you did not start.** Tests start their own herdr or
  tmux on a throwaway socket. The developer's live herdr is read-only.
- **No new dependencies** unless a few lines cannot do the job. Say why in the pull request.
- **No secrets in the repository.** CI runs gitleaks on every push and pull request. If a
  secret slips in, rotate it; a force-push does not remove it from GitHub.
- Keep the shortest diff that works. A shortcut with a known ceiling gets a `// ponytail:`
  comment naming the ceiling and the upgrade path.

## Checks

Run these before opening a pull request; CI runs the same:

```sh
make test        # bun test: unit and contract tests
make check       # typecheck + build
```

Contract tests need `herdr` and `tmux` on PATH; they skip when a binary is missing.

## Pull requests

- One phase item or one bug per pull request.
- Tick the roadmap box in the same pull request, only if you verified on a real device.
- Describe what you verified and how, not what you changed; the diff shows that.

## Release

A release is one tag. The workflow does the rest.

1. Bump `version` in `package.json`.
2. Add a section to `CHANGELOG.md` for the new version, in user terms: what you can now do.
3. Commit both, then tag and push:

   ```sh
   git tag v0.1.0
   git push origin v0.1.0
   ```

`.github/workflows/release.yml` runs on any `v*` tag and does three things:

- Builds the container image and pushes it to `ghcr.io/radityasurya/tautan`, tagged with the
  version and `latest`. This needs no setup; it uses the workflow's own `GITHUB_TOKEN`.
- Publishes the package to npm with `--provenance`, but only if the `NPM_TOKEN` repository
  secret exists. Without it the step logs a skip and the job still passes.
- Creates a GitHub release with generated notes.

To publish to npm, add the secret once:

1. On npmjs.com, create a **granular access token** with read and write access to the
   `tautan` package. Give it the shortest expiry you can live with.
2. In this repository, open **Settings → Secrets and variables → Actions → New repository
   secret**.
3. Name it `NPM_TOKEN` and paste the token.

Rotate the token when it expires; the workflow reads it fresh on every run.

## Reporting a bug

Open an issue with: Hub OS and Bun version, herdr or tmux version, phone and browser,
and the output of `curl 127.0.0.1:7700/api/state` with paths redacted.
