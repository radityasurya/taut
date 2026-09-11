# taut UI, as built

One section per screen: what it renders today, which file owns it, and the
behaviour worth knowing. Reasoning lives in [DESIGN.md](./DESIGN.md), mockups
in [design/](./design/).

## Run it

- Mock data: `pnpm dev:web`, then `http://127.0.0.1:5173/?mock`. `main.tsx`
  calls `installMock()`, which patches `fetch`, `EventSource` and
  `XMLHttpRequest` with the fixtures in `web/mock.ts`.
- Real data: `pnpm dev` (Hub on 7700, Vite on 5173), then
  `http://127.0.0.1:5173/`.

Screenshot helpers, all under `?mock`: `&still` freezes the ticker, `&theme=`
forces a theme, `&open=switch|more|newtab|newworkspace|addhost` opens a sheet.

## Tokens

| Token | Value | Used by |
|---|---|---|
| `rounded-chip` | 8px | chips, buttons, key caps |
| `rounded-composer` | 10px | composer, search field, sheet fields |
| `rounded-card` | 12px | Host cards, blocked card, dialog |
| `rounded-tabbar` | 14px | bottom tab bar |
| `rounded-drawer` | 16px | drawer top, Pane dock top |
| `text-caption` | 12/1.35 | meta lines, mono text |
| `text-body` | 15/1.45 | rows, fields |
| `text-title` | 17/1.25/600 | screen and sheet titles |
| `label-caps` | 11px, 600, `.08em`, uppercase | section headings |

## Motion

Four movements, all in `web/theme.css`, all off under
`prefers-reduced-motion: reduce`.

| Movement | What |
|---|---|
| Screen push | `::view-transition-new(root)`, 200 ms; `navigate()` skips the transition entirely under reduced motion |
| Tab underline | one accent bar under the Tab strip, `transition: transform, width` 200 ms ease-out, measured from the selected tab |
| Blocked card | `.rise`: `translateY(10px)` and opacity over 200 ms, same curve as the push |
| Press | `.press`: `scale(0.97)` while `:active`, 120 ms ease-out, on rows, chips, tabs and key caps |

Colours come from `data-theme` on `<html>`: seven themes, each defining the
chrome tokens plus 16 ANSI colours (`web/theme.css`). shadcn's variable names
are aliased onto taut's tokens in the same file; `--border` is deliberately not
aliased, because taut already owns that name and the alias would be a cycle.

Mono text uses `web/public/taut-box.woff2`: 8,976 bytes, 372 glyphs, subset
from DejaVu Sans Mono with `pyftsubset` (no Nerd Font on this machine). Its
`unicode-range` covers box drawing, blocks, Braille, arrows, geometric shapes
and the check/cross agents print; the rest falls through to the system stack.

## Agents (`#/`) — `web/home.tsx`

The screen title is `taut`, with `<hosts> · <panes>` counts and a `+` that
opens New Workspace. Host chips appear under the header only when there is
more than one Host.

Unseen `blocked` and `done` Panes lift out into a **Needs you** section;
everything else groups by Workspace, most urgent Status first. A group header
is a button: tap collapses (persisted in `localStorage`), long-press (500 ms,
cancelled by 10 px of movement) opens the group menu. Collapsed, it summarises
its most urgent Status, for example `2 blocked`.

On a new device, an empty local Seen map is seeded from the first snapshot's
current Pane revisions, so old `done` work does not immediately fill **Needs you**.
A `blocked` Pane is always actionable and appears there regardless of Seen history.

A row is one link with one `aria-label`; every visual part inside it is
`aria-hidden`. Line 1 is the Agent name plus the title; line 2 is the Pane's
last line, or `basename(cwd)` in mono when there is none. The 8 px Dot is
filled when unseen and a 1.5 px ring when seen — decoration only, since the
label carries the fact. An offline Host adds a red row linking to Hosts. While
`state` is null the list is three skeleton rows; with nothing to show it reads
`No panes yet.` above an `Add a Host` link.

## Pane (`#/pane/<key>`) — `web/pane.tsx`

Top bar: back, title, and a status line that doubles as the Switch button —
Dot, the Status word (`aria-live="polite"`), Agent and Workspace. Right side:
Switch, Read aloud (Agent Panes only) and More. Under it, the **Tab strip**
lists that Workspace's Tabs, each with a 6 px Dot rolled up from its Panes,
then `+` for New Tab, then the grid chip at the right end (`80×24`, or
`80×24 · fit` when pressed). Fit scales the `<pre>` to the room the scroller
leaves after its own left padding. A horizontal **touch** swipe on the strip
moves between Tabs: Chromium gives a horizontal drag to the nearest scroller
and fires `pointercancel`, so the gesture reads `touchend`, and it is ignored
when the strip itself scrolled, which is what a drag means once there are more
Tabs than fit. One accent underline slides between the Tabs. When the open Tab
holds several Panes, a chip row lists them.

The grid renders the `visible` screen as styled ANSI spans, pinned to the
bottom until you scroll up, when a **New output** pill appears. Content wider
than the phone fades at the right edge instead of showing a scrollbar. There is
no Screen/Recent switch: taut only ever shows the visible grid, and Wrap (in
More) reflows it client-side.

When Status is `blocked`, `web/blocked.tsx` draws a card above the dock: the
detection's first line as a heading, the rule id, up to two excerpt lines in
the agent's colours, and one button per offered key plus ↑/↓. It rises into
place over 200 ms and fades 150 ms after the Status clears.

`shared/blocked.ts` decides which keys the card offers, and the Hub applies the
same function on the way out, so `GET /api/panes/:key/explain` already carries
them. A prompt whose rule id names a permission or approval, **or** whose box
offers Yes / Allow / Accept as its first option, leads with the preset
`enter` = **Yes** and `esc` = **No**; the Mux's own hint keys follow, minus the
duplicates, because the footer's `esc to cancel` and `enter to confirm` are the
preset under another name. The id alone is not enough: a real Claude Code
permission box matches `live_blocked_form`, never `bash_permission_prompt`.

The dock is the only place with input: a horizontally scrolling key bar (a
longer set for shell Panes), and — for Agent Panes only — the composer, with
dictation into the field, an attach button, and Send. Enter sends; Shift+Enter
inserts a newline. The mic replaces Send only while the field is empty **and**
the browser has `webkitSpeechRecognition`; with no engine the disabled Send
button keeps its place rather than offering a mic that does nothing. A
transcript lands in the field for review and is never sent on its own.

Attach opens the photo library, never the camera: the hidden input has
`accept="image/*,video/*"`, `multiple`, and no `capture`. Each file goes out on
its own XMLHttpRequest as a raw body with the name in `X-Name`; `post()` is JSON
only, and an upload needs progress and an abort. While any upload runs, a 2 px
accent line under the composer shows the average progress. Each file gets a
chip with its name, its size and a × that removes it; the × also aborts an
upload in flight and takes the path back out of the field. On 200 the Hub's
absolute `path` is appended to the field, space-separated, because Claude Code
and Pi read an absolute image path out of the prompt; the chip's tooltip shows
the `~` form. A failure writes one muted line under the composer
(`IMG_0001.jpeg failed · too large`) with a **Retry** button. Send clears the
text and every chip that is not still uploading. `?mock` swaps in a small
`XMLHttpRequest` stand-in that ticks progress three times and answers from the
fake Hub.

**HEIC.** iOS hands a Photos pick to the page as JPEG, so taut needs no HEIC
decoder. A reproduction on iOS tried ten `accept` values, from empty through
`image/*` and `image/heic` to explicit lists, and got a JPEG every time, in
Safari, Chrome, Firefox and Edge alike: the conversion lives in iOS WebKit
([zenn.dev test matrix](https://zenn.dev/kou_pg_0131/articles/safari-input-file-heic)).
The value to avoid is `image/heic` in the list: from Safari 17, it makes iOS
convert a JPEG or PNG pick *to* HEIC, renamed `tempImage….heic`
([Apple Developer Forums](https://developer.apple.com/forums/thread/743049)).
So `image/*,video/*` stays. A photo that reached the phone through Files,
AirDrop or Dropbox skips that path and can still arrive as HEIC; the Hub stores
it unchanged. Unverified here: no real iPhone was in this session, and the
camera's **Formats** setting (High Efficiency or Most Compatible) was not tried.

## Hosts (`#/hosts`) — `web/hosts.tsx`

One card per Host: online Dot, label, SSH target (or `this machine`), Pane
count, and a line per Mux with its kind, label and Pane count. An offline Host
shows the error and a **Retry now** button that POSTs
`/api/hosts/:id/retry`; the SSE `state` event is the receipt. The last card is
a dashed **Add Host** button that opens the Add Host sheet.

## Settings (`#/settings`) — `web/settings.tsx`

Theme chips (System plus six themes, each with its own `--bg` as the swatch;
the current one scrolls itself into view), a push toggle, a Haptics toggle on
Android only, the iOS install hint, and read-only Access rows for the trusted
login and what serves the app. Hosts live on their own tab, not here.

The push toggle is the only control with a failure state, so it has five:

| State | What you see |
|---|---|
| Off | The plain switch. `taut.push` in `localStorage` is `0` or absent |
| On | The switch is on. The browser holds a subscription and the Hub has its endpoint |
| Denied | The switch flips back and a muted caption reads "Notifications are blocked for this site. Allow them in your browser settings, then turn this on again." |
| Unsupported | The same caption pattern: "This browser does not support push notifications." |
| iOS, not installed | The install hint sits under the toggle: push reaches only the app you added to the Home Screen |

The caption is one muted `text-caption` line, in the flow under the row. No
toast, no dialog: turning a switch on is not worth an overlay.

## Sheets — `web/sheets.tsx`, `web/switch.tsx`

Bottom sheets are the shadcn Drawer (vaul): swipe to dismiss, scroll lock,
focus trap and Escape come from the library. `Sheet` supplies the surface, the
title and the meta line.

- **Switch** (`web/switch.tsx`): 85 dvh, search field, Host chips, then every
  Workspace with its Panes under the Tab they belong to. Two taps to any Pane.
- **New Tab**: label, directory (mono), one Agent chip per known agent plus
  `shell only`, as radio inputs.
- **New Workspace**: directory, label, optional branch that creates a worktree.
- **Rename**: one field, for a Workspace, Tab or Pane.
- **More**: the ⋯ menu — Wrap, Rename, Close Pane, and a disabled
  `Resize to phone` marked `v2`.
- **Close Pane** is a Dialog, not a drawer, so a destructive action cannot be
  swiped into by accident.

Creation, rename and close reach herdr in phase 7. Today the sheets validate,
close, and change nothing.

## Chrome — `web/app.tsx`

Hash routes pushed with `history.pushState`, so the iOS edge swipe and the
Android back button work, wrapped in a View Transition. One `EventSource` for
the whole app; it reopens when the watched Pane changes, and a hairline
`Reconnecting` bar shows while it is down. The floating bottom tab bar
(Agents · Hosts · Settings) badges unseen `blocked` Panes and hides itself
whenever a text field has focus, so the keyboard never covers the composer.

The **app badge** on the installed icon counts more than the tab badge does:
unseen `blocked` plus unseen `done`, the same set the **Needs you** section
holds. `web/app.tsx` writes it on every `state` event through `setBadge()` in
`web/push.ts`, which is a no-op where `navigator.setAppBadge` is missing.

The **service worker** (`web/public/sw.js`) caches the shell it is built with:
`vite.config.ts` stamps `index.html`, the manifest and every hashed asset into
`self.__PRECACHE`, and the cache is named after that list. Navigations and
`/api/*` are network-first and fall back to the cache, hashed assets under
`/assets/` are cache-first, and `/api/events` is never intercepted, because
buffering an SSE stream through a worker stops it. In dev the worker registers
only with `?sw` in the URL, so Vite keeps its own reload path.
