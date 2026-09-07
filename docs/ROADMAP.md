# Roadmap

Each phase is a tracer bullet: it ships something you can use from the phone, end to end.
Tick a box when the verification step passes on a real device. Details of the design live
in [ARCHITECTURE.md](./ARCHITECTURE.md); vocabulary in [../CONTEXT.md](../CONTEXT.md).

## Phase 0 — UI skeletons (every screen, mock data, no Hub)

Goal: walk the whole app on the phone and judge the look and the interaction model before
anything is wired. Later phases replace mock data with real calls; the screens stay.

- [ ] `web/mock.ts`: one fixture set covering every state: two Hosts, herdr and tmux Muxes,
      Panes in all five Statuses, seen and unseen, a blocked Pane with a permission prompt
      and hint keys, an offline Host, an empty Workspace
- [ ] `?mock` in the URL (or `VITE_MOCK=1`) swaps the API layer for fixtures; SSE simulated
      with a timer so screens "tick"
- [ ] Home: grouped list, status dots, unseen emphasis, host chips, empty state, offline banner
- [ ] Pane: grid view, recent view, blocked card with buttons, key bar, composer with mic,
      attach and send, read-aloud button, swipe between Panes
- [ ] Settings: theme picker (all six + system), hosts list and add-host sheet, push toggle,
      "add to Home Screen" hint, trusted login field
- [ ] Sheets: new Tab, new Workspace / worktree, rename, close confirm
- [ ] PWA shell: manifest, icons, standalone display, safe-area insets

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

- [ ] Explain card: detection region + buttons from footer hints + permission preset
- [ ] Seen: POST on open and on screen updates; Home sorts unseen `blocked` first
- [ ] Recent (reflowed) mode
- [ ] Swipe between Panes of a Workspace
- [ ] Read-aloud (speechSynthesis) and mic (speech recognition into the composer)
- [ ] `test/mux.contract.test.ts` for herdr on a throwaway socket; `test/ansi.test.ts`

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

## Phase 8 — ship

- [ ] `Dockerfile` (`oven/bun`), README install paths (`bunx taut`, systemd, Docker on Unraid)
- [ ] `npm publish`

## Later (explicitly out of v1)

- Split / move / layout editing
- Per-agent prompt grammars (native widgets for select lists)
- Passcode or SSO in front of the Hub
- Per-Workspace push muting; attachment pruning
