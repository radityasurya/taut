# Roadmap

Each phase is a tracer bullet: it ships something you can use from the phone, end to end.
Tick a box when the verification step passes on a real device. Details of the design live
in [ARCHITECTURE.md](./ARCHITECTURE.md); vocabulary in [../CONTEXT.md](../CONTEXT.md).

## Phase 0 — UI skeletons (every screen, mock data, no Hub)

Goal: walk the whole app on the phone and judge the look and the interaction model before
anything is wired. Later phases replace mock data with real calls; the screens stay.

- [x] `web/mock.ts`: one fixture set covering every state: two Hosts, herdr and tmux Muxes,
      Panes in all five Statuses, seen and unseen, a blocked Pane with a permission prompt
      and hint keys, an offline Host, an empty Workspace
- [x] `?mock` in the URL (or `VITE_MOCK=1`) swaps the API layer for fixtures; SSE simulated
      with a timer so screens "tick"
- [x] Home: grouped list, status dots, unseen emphasis, host chips, empty state, offline banner
- [x] Pane: top bar (back, title, status line → Switch, actions), Tab strip with + and Fit,
      grid with Wrap, blocked card with buttons, key bar presets, composer with mic, attach and
      send, read-aloud
- [x] Settings: theme chips (all six + system), push toggle, haptics toggle, "add to Home
      Screen" hint, trusted login and served-by rows. Hosts live in their own tab as cards
- [x] Sheets: new Tab, new Workspace / worktree, rename, close confirm
- [ ] PWA shell: manifest, icons, safe-area insets are in; standalone display is verified on a
      device in phase 3
- [x] Floating bottom tab bar on Home, phone style: Panes · Hosts · Settings, with a badge
      for unseen `blocked`
- [x] Agent-aware Pane chrome: when the Pane runs Claude Code or Pi, the composer reads as
      that agent's prompt box, and a chip row at the top switches between the Agents of the
      same Workspace; shell and monitor Panes (htop, logs) render as a plain grid

Verify: open `https://<hub>:5173/?mock` on iPhone and Android; walk every screen in all
six themes; nothing needs a running herdr.

Built after phase 1 lands (phase 1 was started first); reuses its Home, Pane and theme code.

## Phase 1 — see and reply to a local herdr Pane

- [x] Glossary (`CONTEXT.md`), ADRs 0001 and 0002
- [x] `shared/types.ts` — Mux interface and API payloads
- [x] `shared/ansi.ts` — SGR parser to styled spans
- [x] `server/herdr.ts` — one-request-per-connection client, event subscription, snapshot
- [x] `server/mux.ts` — Hub: Mux registry, state projection, Seen, SSE fan-out
- [x] `server/http.ts` — `/api/state`, `/api/events`, screen, input, static, Origin check
- [x] `server/main.ts` — XDG paths, local Mux discovery, start
- [x] `web/` — Home list, Pane screen (grid, key bar, composer), themes

Verify:
1. `pnpm dev`, then `tailscale serve --bg 5173` on the Hub.
2. On the phone: Home lists panes; open a Claude Code pane; send a reply; the screen updates in under 300 ms.
3. `curl -H 'Origin: http://evil' -X POST http://127.0.0.1:7700/api/panes/x/input` returns 403.

## Phase 2 — triage

`[~]` = built on mock data, awaiting verification on a real phone.

- [~] Explain card: driven end to end in an emulated iPhone against a real Claude Code
      permission box in a throwaway herdr — herdr matched `live_blocked_form`, the card
      offered Yes/enter and No/esc, and a tap sent `enter` to the Pane. Real phone pending
- [~] Seen: driven end to end in an emulated iPhone — a fresh device starts with an empty
      **Needs you**, an unseen `done` Pane enters it, opening the Pane POSTs
      `/api/panes/:key/seen`, and the row leaves. A throwaway herdr freezes every `revision`
      at 0, so the unseen comparison was fed a seeded value; verify it on a real device
- [x] Wrap and Fit on the grid (replaced the Recent mode; see DESIGN.md "Terminal width on a phone")
- [~] Swipe between Tabs on the strip: exercised with emulated touch, which found that
      Chromium cancels the pointer stream mid-drag; the gesture now reads `touchend` and the
      grid never receives it. Real finger pending
- [~] Read-aloud and mic: exercised in an emulated iPhone against stubbed engines —
      read-aloud speaks the last block, the mic is absent with no engine, and a transcript
      lands in the composer without sending. Real iOS dictation and voices pending
- [x] `test/mux.contract.test.ts` and `test/blocked.contract.test.ts` for herdr on a
      throwaway socket (`test/ansi.test.ts`, `test/herdr.test.ts`, `test/mux.test.ts` exist)

Verify: trigger a permission prompt in a real Pane; the card shows buttons; a tap answers.
`bun test` is green. Confirm `herdr server` honours `HERDR_SOCKET_PATH` first.

## Phase 3 — push

- [ ] VAPID keys generated on first run into `state.json`
- [ ] `web/public/sw.js`, `manifest.webmanifest`, install hint on iOS
- [ ] Push only on Status → `blocked`; app badge for unseen `blocked` + `done`

Verify: installed PWA on iPhone and Android receives a notification; tapping opens the Pane.

## Phase 4 — attachments

- [ ] Attach button (image/video); raw-body POST with `X-Name`; path appended to composer
- [ ] Remote Hosts: stream into `ssh target 'cat > ~/.cache/taut/…'`

Verify: a photo from the phone lands in `~/.cache/taut/` on the Host and the agent reads it.

## Phase 5 — remote Hosts

- [ ] `server/hosts.ts`: `hosts.json` + `herdr machine list --json` merge
- [ ] `ssh -L` unix-socket forwarders with reconnect; ControlMaster for tmux commands
- [ ] Settings screen: hosts, theme, push, trusted user

Verify: kill a forwarder; it reconnects. Remote Panes show a Host chip.

## Phase 6 — tmux

- [ ] `server/tmux.ts` local + remote; polling; write ops hidden in the UI
- [ ] tmux contract tests (`tmux -f /dev/null -S <sock>`)

Verify: tmux Panes show Status `unknown`; read and send work.

## Phase 7 — write operations (herdr)

- [ ] New Tab + start Agent; new Workspace / worktree; rename; close Pane

Verify: start `claude` in a new Tab from the phone.

## Phase 8 — diff review

- [ ] Hub runs `git diff --no-color -U3` (working tree, `--staged`, and base…HEAD with the
      base resolved like herdr-hunk-diff: upstream → `origin/HEAD` → main/master) in the
      Workspace cwd, local or over SSH; `GET /api/workspaces/:key/diff?scope=`
- [ ] PWA renders it with `gitdiff-parser` + `react-diff-view` (MIT), unified view on the
      phone, per-file collapse, hunk headers; opened from the Pane's ⋯ menu and the Workspace
      long-press menu
- [ ] hunk itself is a TUI with no web or JSON mode, so it is not embedded; a hunk pane still
      opens like any other Pane

Verify: after an agent edits files, open Diff from the Pane; hunks render with syntax-free
coloring; staged and unstaged scopes switch.

## Phase 9 — ship

- [ ] `Dockerfile` (`oven/bun`), README install paths (`bunx taut`, systemd, Docker on Unraid)
- [ ] `npm publish`

## Later (explicitly out of v1)

- Split / move / layout editing
- Per-agent prompt grammars (native widgets for select lists)
- Passcode or SSO in front of the Hub
- Per-Workspace push muting; attachment pruning
