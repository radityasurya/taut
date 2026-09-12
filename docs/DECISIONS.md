# Decisions

The design was settled in one long interview on 2026-09-07 and confirmed by the maintainer.
This is the record. The two irreversible choices also have ADRs in [adr/](./adr/).

## Product

| Topic | Decision | Why |
|---|---|---|
| Job of the app | Agent triage and full terminal are equal | Termius covers only the terminal; collie covers only triage well |
| Bar vs collie | Clean, non-boxy look; two-tap interaction model | The maintainer's two complaints about collie |
| Look | Linear / Notion / Slack / Discord density; hand-styled with selected shadcn pieces | collie's boxy look is largely shadcn defaults |
| shadcn pieces (recon 2026-09-08) | Adopt Drawer (vaul) for bottom sheets, Dialog for confirm-close, Skeleton for loading, Sonner for toasts from phase 7. Port the mic and attachment wiring from AI Elements `prompt-input` by hand. Everything else stays hand-rolled: status dots, rows, section headers, empty states, offline banner, settings rows, segmented control, composer, ANSI renderer, install hint | Drawer is the one clear win (swipe-to-dismiss, scroll lock, focus trap). AI Elements would pull five Radix primitives tautan has no other use for. No registry renders a live terminal grid |
| Theme tokens | Keep tautan's own token names; values are already the Catppuccin palette | catppuccin/shadcn-ui is copy-paste CSS in shadcn's names; renaming every utility buys nothing |
| bencho.dev (recon 2026-09-11) | Reference for press and spring feel only; no component adopted, no Motion dependency | No npm package or registry, copy-paste only, four blocks paywalled, bespoke class scheme with no upstream; half the catalog is mouse-hover or skeuomorphic and wrong for a touch PWA. The useful feel (tab underline slide, card spring-in, `:active` scale) is a few lines of CSS |
| Themes | One selector: System, Light, Dark, Catppuccin Latte / Frappé / Macchiato / Mocha | Each entry defines chrome tokens and 16 ANSI colors; one table, no code |
| Interaction | Home is one flat Pane list, unseen `blocked` first; tap opens the Pane; swipe between Panes of a Workspace | Anything not reachable in two taps is a later feature |
| Blocked UX | Buttons from herdr's own detection (rule id, detection region, footer hints) | collie's per-agent grammars are ~680 KB; herdr already classifies 19 agents |
| Push | Only on Status → `blocked`; `done` is a badge | `done` fires constantly while agents work |
| Media | Photos and videos upload to `~/.cache/tautan/` on the Host, path goes into the prompt; mic dictates into the composer for review; read-aloud speaks the last block | Agents read image paths; nobody wants unreviewed dictation sent |
| License | MIT, public | Same as collie; permissive for a personal tool others may use |

## Architecture

| Topic | Decision | Why |
|---|---|---|
| Backends | One interface, two implementations: herdr full, tmux read + input | Two real implementations earn an interface; a third earns capability flags |
| Rendering | Multiplexer's rendered screen as styled spans; no xterm.js, no PTY | [ADR 0001](./adr/0001-render-mux-snapshots-not-a-pty.md) |
| Topology | One Hub on the always-on Host; other Hosts over SSH | [ADR 0002](./adr/0002-hub-reaches-hosts-over-ssh.md) |
| Host list | `herdr machine list --json` read-only, merged with tautan's own `hosts.json` | A phone tap must not install software on a server |
| SSH | Hub user's existing config, agent and keys; tautan manages none | Tailscale SSH or keys already exist between these machines |
| Transport | SSE down, POST up, raw-body POST for attachments | EventSource reconnects by itself on Wi-Fi/cellular flips; screens are text |
| Focus | The Hub never calls `*.focus`; Seen is tautan's own flag | The maintainer may be sitting at the same herdr on a desktop |
| Auth | Tailscale only; loopback bind; Origin check; optional trusted login | One-user tailnet today; passcode/SSO later |
| Runtime | Bun end to end, pnpm, Vite + React + Tailwind v4, `bun test` | No build step for the server; `bunx tautan` |
| Packaging | npm package plus Docker image (`oven/bun`) | Unraid runs containers; VPS runs a unit |
| Tests | Contract suite over both adapters against real binaries on throwaway sockets | The adapter's whole job is talking to a real binary |
| Web dependencies (integration pass 2026-09-10) | Four runtime deps: `vaul`, `@radix-ui/react-dialog`, `clsx`, `tailwind-merge`. The shadcn Drawer, Dialog and Skeleton are copied into `web/components/ui/`, restyled onto tautan's tokens; no shadcn theme is installed, and shadcn's variable names are aliased onto tautan's tokens in `web/theme.css`. `--border` is intentionally not re-aliased | Drawer and Dialog carry swipe-to-dismiss, scroll lock, focus trap and Escape, which is the whole reason to take a dependency; `clsx` and `tailwind-merge` are what the copied files import. A second palette would fight tautan's tokens, and `--border: var(--border)` would be a cycle |
| Diff viewer (recon 2026-09-08, revised 2026-09-12) | Run `git diff` in the Workspace cwd, parse it with the hand-written `shared/diff.ts`, and render it with tautan's own renderer in `web/diff.tsx`; no `gitdiff-parser`, no `react-diff-view`, and hunk is not embedded | A 43-line parser and a table of rows beat two dependencies for a unified-only view. hunk (modem-dev/hunk, MIT, 9k★) is a terminal renderer with no web or JSON output; mirroring its TUI is no better than opening its pane. The herdr-hunk-diff plugin only orchestrates hunk inside a pane |

## Vocabulary

Host → Mux → Workspace → Tab → Pane, plus Agent, Status, Seen. "Session" is banned because
it means Mux in herdr and Workspace in tmux. See [../CONTEXT.md](../CONTEXT.md).

## Prior art, and why tautan is not a fork

| Project | What it is | Why not |
|---|---|---|
| [collie](https://github.com/AltanS/collie) | MIT PWA for herdr/tmux/zellij over Tailscale; Bun bridge on the socket; polling; no xterm.js; push; pairing | Closest match. Rejected for its look and interaction model; forking ties tautan to a 1,200-commit codebase shaped like that. Its auth design (loopback + identity header + Origin checks) is adopted by description. |
| [herdr-webui](https://github.com/alecuba16/herdr-webui) | Rust/Axum web IDE for herdr: files, git, WebSocket terminal | IDE-shaped, not phone-shaped; no PWA; AGPL-ish license |
| [Moshi](https://getmoshi.app) | Closed native SSH/Mosh client with agent inbox and Watch support | Native app; not open source. Gesture ideas (swipe between Panes, pinch zoom) adopted |
| ttyd, gotty, wetty, sshx | Terminal-in-browser over WebSocket with xterm.js | Terminal only, no agent state, no mobile chrome |
| Happy Coder, Omnara, VibeTunnel | Mobile clients wrapping Claude Code / Codex directly | Tied to one agent CLI, not to a multiplexer |

Other mobile herdr UIs exist (eyalev/herdr-web, barnuri/herdr-web, amacsmith/her-di-dr);
none was inspected before building.

## 2026-09-12 — Phone-sized Pane rendering

Herdr 0.9 cannot give the Hub a Pane rendered at a caller-selected column count without affecting a desktop client viewing the same Tab. The local read-only evidence is `herdr api schema --json`: `PaneReadParams` offers only `format`, `lines`, `pane_id`, `source`, and `strip_ansi`; `PaneResizeParams` requires `direction` and optionally takes `amount`; and `AgentViewSetParams` contains agent-list `filter`, `label`, `sort`, and `source`, not terminal dimensions. `herdr pane read --help` agrees: “`--source <SOURCE>`”, “`--lines <N>`”, and “`--format <FORMAT>`” are its only rendering controls. The 0.9 changelog adds pane names and agent prompt/status helpers, not an independently sized Screen ([CHANGELOG 0.9.0](https://github.com/motionharvest/herdr/blob/main/CHANGELOG.md#090---2026-08-14): “A pane's assigned name … now works anywhere a pane id does”). The server owns Pane state ([Concepts](https://herdr.dev/docs/concepts/): “The server owns panes and process state”), and when two clients view one Tab, “the last one to focus, select, or interact with it controls that tab’s pane sizes.” `surface_interest` only selects which saved-SSH machine streams a Pane surface ([Socket API](https://herdr.dev/docs/socket-api/): “only the selected machine streams a pane surface”); it does not create a separately sized surface. Therefore tautan keeps Wrap and Fit; any true resize must be a future explicit, shared-layout action with restoration after Herdr exposes exact dimensions or an independent client surface.
