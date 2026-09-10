# taut UI, as built

One section per screen: what it renders today, which file owns it, and the
behaviour worth knowing. Reasoning lives in [DESIGN.md](./DESIGN.md), mockups
in [design/](./design/).

## Run it

- Mock data: `pnpm dev:web`, then `http://127.0.0.1:5173/?mock`. `main.tsx`
  calls `installMock()`, which patches `fetch` and `EventSource` with the
  fixtures in `web/mock.ts`.
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
`80×24 · fit` when pressed). Fit scales the `<pre>` to the viewport width;
horizontal swipe on the strip moves between Tabs. When the open Tab holds
several Panes, a chip row lists them.

The grid renders the `visible` screen as styled ANSI spans, pinned to the
bottom until you scroll up, when a **New output** pill appears. Content wider
than the phone fades at the right edge instead of showing a scrollbar. There is
no Screen/Recent switch: taut only ever shows the visible grid, and Wrap (in
More) reflows it client-side.

When Status is `blocked`, `web/blocked.tsx` draws a card above the dock: the
detection's first line as a heading, the rule id, up to two excerpt lines in
the agent's colours, and one button per hint key (`enter`/`esc` are always
offered on a permission rule) plus ↑/↓. It fades 150 ms after the Status
clears.

The dock is the only place with input: a horizontally scrolling key bar (a
longer set for shell Panes), and — for Agent Panes only — the composer, with
dictation into the field, an attach button, and Send. Enter sends; Shift+Enter
inserts a newline.

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
