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

`[~]` = built and driven in an emulated phone, awaiting verification on a real device.

- [x] VAPID keys generated on first run into `state.json` — `server/push.ts` encrypts
      (RFC 8291) and signs (RFC 8292) with WebCrypto, `server/mux.ts` keeps the pair and
      the subscriptions; `test/push.test.ts` covers aes128gcm, TTL, urgency, the
      `Authorization` header and pruning a subscription the push service answers with 410
- [x] `web/public/sw.js`, `manifest.webmanifest`, install hint on iOS — the worker shows
      the notification, routes the tap and caches the shell from the `self.__PRECACHE`
      list that the `taut-sw-precache` plugin in `vite.config.ts` stamps into it;
      `web/push.ts` subscribes and `web/settings.tsx` owns the toggle and the install hint
- [x] Push only on Status → `blocked`; app badge for unseen `blocked` + `done` —
      `server/mux.ts` sends on the transition only; `web/app.tsx` writes the badge from
      SSE state with `setBadge()` from `web/push.ts`
- [~] Installed PWA receives a notification — an emulated Pixel on a real Hub registered
      `sw.js`, subscribed to FCM, got 204 from `POST /api/push/subscribe` and left the
      endpoint in `state.json`; turning the toggle off pruned it again. A real iPhone and
      a real Android, and the tap that opens the Pane, are pending

Verify: installed PWA on iPhone and Android receives a notification; tapping opens the Pane.

## Phase 4 — attachments

`[~]` = built and driven in emulated mobile Chromium, awaiting verification on a real phone.

- [~] Attach button (image/video); raw-body POST with `X-Name`; path appended to composer —
      driven in an emulated iPhone 13 against `?mock`: a pick showed the progress line and
      a chip, the absolute path landed in the field, removing the chip took the path back
      out and aborted an upload in flight, Send cleared both, and an empty file showed
      `empty file` with Retry. `test/attach.test.ts` covers the Hub route. A real photo
      from a real phone, and the HEIC → JPEG hand-off (see UI.md), are pending
- [ ] Remote Hosts: stream into `ssh target 'cat > ~/.cache/taut/…'` — needs the SSH
      forwarders of phase 5

Verify: a photo from the phone lands in `~/.cache/taut/` on the Host and the agent reads it.

## Phase 4b — grid width and quick replies

`[~]` = built and driven in emulated Chromium against `?mock`, awaiting a real phone.

- [x] Grid: desktop/tablet column grows to the grid's natural width (no scaling below the
      window width); Fit off by default; Wrap off by default (a wrapped prompt box read worse than a scrolled one); both remembered
      — at 1600 px the 120-column mock Pane renders at 12 px, `<pre>` 867 px wide and
      centred, `scrollingElement.scrollWidth` 1600 = `innerWidth`, no transform
- [x] Research "Resize to phone": can a herdr 0.9 client view size a Pane independently of
      the desktop layout? If yes, design it; if no, keep it a v2 explicit action — Verdict:
      not possible in herdr 0.9 — `PaneReadParams` has no width, `pane.resize` changes the
      shared split; see DECISIONS.md 2026-09-12 and DESIGN.md "Terminal width on a phone"
- [x] Dock order: suggestion pills · composer · key bar (keyboard accessory row at the bottom)
      — read back from the DOM in an emulated iPhone 13 as Quick replies, composer, Keys
- [~] Quick replies: key pills send immediately; text pills fill the composer for review.
      Static set per agent (Claude Code, Pi) plus three generated from the last screen block
      by a small model (GLM via z.ai first, Anthropic behind the same adapter), one call per
      Status change, cached by revision, off until "Smart replies" is enabled in Settings
      — `web/replies.ts` decides the pills and `test/replies.test.ts` covers the rules; the
      blocked Claude Code Pane offers Yes ↵, No esc, ↑, ↓, three ✦ drafts and five texts
- [x] Mockup updated in docs/design (pane-agent) before the build — the export already
      shows the pill row above the composer and the key bar last

Verify: on the desktop browser a 120-column pane renders at 12 px with no sideways scroll;
on the phone a blocked Claude Code pane offers Yes/No plus three sensible replies.
Verified 2026-09-12: a throwaway Hub on 7716 with `TAUT_SUGGEST=zai` answered
`POST /api/panes/:key/suggest` with HTTP 200 and three pills from glm-5.2.

## Phase 5 — remote Hosts

`[~]` = built, awaiting the verification step on a real remote Host.

- [~] `server/hosts.ts`: `hosts.json` + `herdr machine list --json` merge — `GET /api/state`
      now carries offline Hosts too (`online: false`, `error` = the last ssh stderr line),
      ordered local → machines → config, and `source` says which list a Host came from, which
      is what decides Edit and Remove on the Hosts screen — `test/hosts.test.ts` covers the
      merge, the socket-path guard, `runtimeDir()` and the probe, retry, settings and login
      routes
- [~] `ssh -L` unix-socket forwarders with reconnect; ControlMaster for tmux commands —
      `POST /api/hosts/:id/retry` re-dials any Host, not only a local one, and answers with
      the updated `StateHost`; the SSE `state` event repaints the card. `test/hosts.test.ts`
      covers the forwarder argv, the reconnect backoff and the remote attach command; the ssh
      forwarder is verified by that argv test only, because `ssh localhost` on this box fails
      at publickey auth — the live reconnect check is manual, in
      [UI.md](./UI.md#manual-check-forward-a-throwaway-herdr-over-ssh)
- [~] Settings screen: hosts, theme, push, trusted user — `web/hosts.tsx` owns the Host cards
      and the Add Host sheet (Label, SSH target, herdr Mux, **Probe**, Save through
      `PUT /api/settings {hosts}`), `web/settings.tsx` owns the Access rows (Login, Trusted
      login with Lock and Unlock through `PUT /api/settings {trustedUser}`), and `web/mock.ts`
      answers `/api/hosts/probe`, `/api/hosts/:id/retry` and `GET`/`PUT /api/settings` from
      fixtures. Driven in an emulated iPhone 13 against `?mock`: an empty target showed
      `Enter a target like user@host`, a refused target showed the ssh error, a reachable one
      listed its Muxes, Save wrote the entry with the id taken from the target host
      (`dev@ok-box…` → `ok-box`), Edit came back prefilled and kept the id, Remove took the
      entry out, Retry disabled itself while the call was out, and Unlock then
      **Lock to this login** returned `trustedUser` to the login the Hub saw. Then against a
      real throwaway Hub on 7716 with a throwaway herdr and one unreachable `hosts.json`
      entry: the local card listed its real `herdr default · 3 panes`, the config card showed
      the Hub's own ssh line (`Host key verification failed.`), Retry answered 200 with the
      `StateHost`, Probe printed the same ssh line, and Settings with no Tailscale header read
      `no identity header · not behind tailscale serve` with **Lock to this login** disabled.
      No horizontal scroll at 390 px on any screen, mock or real

Verify: kill a forwarder; it reconnects. Remote Panes show a Host chip.

## Phase 6 — tmux

- [ ] `server/tmux.ts` local + remote; polling; write ops hidden in the UI
- [ ] tmux contract tests (`tmux -f /dev/null -S <sock>`)

Verify: tmux Panes show Status `unknown`; read and send work.

## Phase 7 — write operations (herdr)

- [x] New Tab + start Agent; new Workspace / worktree; rename; close Pane

Verify: start `claude` in a new Tab from the phone.
Evidence: `bun test` 48 pass, 0 fail (contract tests on a throwaway herdr, Agent start with
the real `claude` binary; `test/write.test.ts` covers 201/204/400/404/501/502), plus phone
screenshots of all four flows against a throwaway Hub on 7715.

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
