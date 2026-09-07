# taut UX

How taut should look and behave on a phone. Decisions here are recommendations for the
phase 0 integration pass; the settled product and architecture calls live in
[DECISIONS.md](./DECISIONS.md) and are not reopened. Vocabulary: [../CONTEXT.md](../CONTEXT.md).

Target: installed PWA, iOS Safari and Android Chrome, over Tailscale. Taste reference:
Linear, Notion, Slack, Discord. One accent, three surfaces, no boxes.

## 1. Navigation

| Option | Verdict | Reason |
|---|---|---|
| **Floating bottom tab bar** | **Adopt** | Both platforms put 3–5 equal top-level destinations at the bottom. Thumb-reachable; the badge lives where the eye already goes |
| Top chips | Reject | Chips read as filters, not destinations. Puts the primary target at the far end of the thumb arc |
| Drawer | Reject | Hides two of three destinations behind a tap. Android moved off the drawer for ≤5 destinations |

**Structure.** `Panes · Hosts · Settings`. Height 52 px plus `env(safe-area-inset-bottom)`,
`position: fixed; inset-inline: 12px; bottom: calc(env(safe-area-inset-bottom) + 8px)`,
`rounded-full`, `bg-overlay/85`, `backdrop-blur`, hairline border. Badge on Panes only: count
of unseen `blocked`; a dot, not a number, above 9.

**Where it shows.** The three root routes only. The Pane screen is a full-screen push with a
back chevron — the grid needs the vertical space and the key bar already owns the bottom edge.
Discord does the same for a channel.

**Keyboard.** The bar must not sit over a focused composer.

| Platform | Mechanism |
|---|---|
| Android Chrome/Firefox | `<meta name="viewport" … interactive-widget=resizes-content>`; the layout viewport shrinks and the bar rides up with no JS |
| iOS Safari | No `VirtualKeyboard` API. Listen to `visualViewport` `resize`; hide the bar when `visualViewport.height < innerHeight - 120` |

Simplest correct rule: hide the tab bar whenever a text field has focus (`focusin`/`focusout`
on `document`), and keep the `visualViewport` listener only for the offset maths in sheets.

**Transitions.** Home → Pane slides in from the right, 200 ms `cubic-bezier(.2,0,0,1)`; back
reverses. Wrap the hash change in `document.startViewTransition` when available; that is one
`if` and it degrades to an instant swap.

**Correction to the brief:** iOS *does* give standalone web apps an edge back-swipe, but only
when real history entries exist, and it double-fires against router-driven navigation. taut
already uses hash routes, so each push is a history entry and both the iOS edge swipe and the
Android back button work. Do not build a custom back-swipe. Do:

- Always show a 44 px back chevron top-left (the only guaranteed affordance).
- Never let `history.replaceState` swallow a Pane open — the OS gesture needs the entry.
- Keep the left 24 px edge free of horizontal-drag targets.

## 2. Home list

Row anatomy, two lines, 56 px:

```
● claude  fix ansi parser                              4m
  Permission required — Bash pnpm test
```

| Element | Choice | Reason |
|---|---|---|
| Status carrier | 8 px dot, **filled = unseen, hollow ring = seen** | One glyph, two facts. iOS Mail's blue dot. A pill is boxy; a left rail widens every row |
| Line 1 | Agent name (muted, 15 px) + title (15 px, truncate) | Agent first is the triage question: which agent wants me |
| Line 2 | Blocked reason, else the last non-empty screen line, else `basename(cwd)` | Slack and GitHub mobile both preview content, not metadata |
| Right | Time since the last **status change**, 12 px, `tabular-nums`, muted | "How stale is this" is the second triage question |
| Unseen | `font-medium` + full-strength `--fg`; seen rows use `--muted` | No background tint — tinted rows are the boxy look |

**Grouping.** Keep by Workspace (matches the mental model and the current code), but insert a
pinned **Needs you** section at the top holding every unseen `blocked` and `done`, and drop
those rows from their Workspace group. That is the Linear inbox over the Slack unread pane:
one urgent list, then the stable structure. Sort inside a group by the existing `rank()`.

**States.**

| State | Treatment |
|---|---|
| Loading | Three skeleton rows (shadcn `Skeleton`), not a spinner, not "Connecting…" |
| Empty (no panes) | One sentence plus one action: "No panes yet." · *Add a Host* |
| Empty Workspace | Hide the group (already the behaviour) |
| Host offline | Inline row inside that Host's section, `--danger` dot plus the SSH error, tappable to Hosts |
| Hub unreachable | Section 5 |

**Pull to refresh: no.** SSE already pushes, `overscroll-behavior-y: none` is already set, and
the gesture would collide with the Needs-you section reordering under the thumb. Put a *Retry*
button in the reconnect banner instead.

## 3. Pane screen

| Pane runs | Header | Chrome |
|---|---|---|
| **Agent** (`pane.agent` set) | Title, status dot + word, `visible/recent` toggle, read-aloud | Agent chip row, sticky blocked card, agent key set, composer with mic |
| **Shell / monitor** | Title, `visible/recent` toggle | Key bar only. No composer chrome, no chips, no read-aloud |

**Composer as the agent's prompt.** Do not clone the agent's ASCII box. Borrow three signals:
the agent's glyph and name as a 12 px muted label above the field (`✻ claude`), the accent
tinted to that agent, and the placeholder in the agent's own voice ("Reply to Claude…"). The
field stays taut's rounded inset control. Cloning the TUI box would be boxy and would lie about
which characters actually reach the agent.

**Agent chip row.** Under the header, horizontally scrollable, one chip per Agent Pane in the
same Workspace, status dot inside each chip, current chip filled with the accent. Render only
when the Workspace has two or more Agent Panes. It is also the visible affordance for the swipe
in section 4.

**Blocked card: sticky, above the key bar.** Not a sheet — a sheet covers the screen you must
read to decide. Not left inline in the grid — the grid scrolls and zooms away from it. Sticky
card, collapsible to one line, and tapping its header scrolls the grid to the detection region.
`web/blocked.tsx` already renders this; it needs `position: sticky; bottom: 0` inside the
scroller's parent and a 150 ms fade-out when the status leaves `blocked`.

**Key bar, ordered by real frequency.**

| Pane | Keys |
|---|---|
| Agent | `esc` `↑` `↓` `tab` `shift+tab` `enter` `ctrl+c` |
| Shell | `esc` `tab` `↑` `↓` `←` `→` `enter` `ctrl+c` `ctrl+d` `ctrl+l` `ctrl+r` |

Arrows on an agent Pane pick list items; `←` `→` never do, so drop them there. Keep `ctrl+c`
last so a mis-tap is unlikely.

**Read-aloud and mic.** Read-aloud is a speaker icon in the header, next to the mode toggle —
it acts on the screen, not on your draft. Mic sits inside the composer and *replaces* the send
button while the field is empty (WhatsApp, Slack). Dictation lands in the field for review; it
never sends, per DECISIONS.

**Font.** 80 columns cannot be legible on a 390 px phone: 366 px of usable width over 80
columns is a 4.6 px advance, about a 7.6 px font. So the default is scrolled, not fitted.

| Question | Recommendation |
|---|---|
| Stack | `--font-mono: "taut-box", ui-monospace, SFMono-Regular, Menlo, "Roboto Mono", monospace` |
| Ship a webfont? | **Yes, one small subset.** iOS resolves `ui-monospace` to SF Mono and Menlo, both of which have full box drawing. Android's Roboto Mono does not, so U+2500 falls back to a *proportional* symbol font and every column after it shifts. That is the whole grid broken on half the devices |
| What to subset | U+2500–257F box drawing, U+2580–259F blocks, U+2800–28FF braille (spinners), U+2190–21FF arrows, U+25A0–25FF shapes, U+2713/2717/2726. `pyftsubset` a Nerd-Font-Mono base to WOFF2 with a `unicode-range` descriptor — Latin still renders in the system font, so there is no FOUT on the common path and the file only downloads when a box character appears. Budget under 40 KB |
| Nerd Font PUA | **Do not ship.** The PUA set is unbounded and a patched font is 2–4 MB. Accept tofu for prompt icons; revisit only if starship prompts are unreadable, then add U+E0A0–E0B8 (Powerline) alone |
| Size | 12 px / 1.35, as today. 11 px is the floor before box joints break up |
| Fit width | A toggle in the header showing the grid size (`80×24`) as its label. On: `transform: scale(clientWidth / scrollWidth)` with `transform-origin: top left` on the `<pre>`. Scaling the element keeps metrics exact — changing `font-size` re-rounds every advance and re-breaks alignment |
| Pinch zoom | Skip. It fights the horizontal scroller and needs real gesture plumbing. Later |
| "Wider than the viewport" cue | A right-edge fade, `mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent)`, applied only while `scrollWidth > clientWidth` and removed at the right end. No scrollbar, no chrome |

## 4. Gestures

| Gesture | Verdict | Note |
|---|---|---|
| Swipe left/right between Agent Panes of a Workspace | **Adopt**, but not on the grid | The grid scrolls horizontally; two horizontal handlers on one surface is the unclear interaction model taut rejected. Bind the swipe to the header, chip row, blocked card and composer strip — the non-scrolling bands |
| Long-press a Home row | **Adopt** | 500 ms, cancel past 10 px of movement, opens a Drawer: Rename · Mark seen · Close Pane. Set `-webkit-touch-callout: none` on the row |
| Pull down for recent mode | Reject | The `visible/recent` toggle is already one tap and always visible. A hidden gesture for a visible control is waste |
| Double-tap for `tab` (Moshi) | Reject | Moshi has no key bar on screen; taut does. One tap already beats two |
| Pinch zoom (Moshi) | Later | See fit width above |
| Haptics | Android only | `navigator.vibrate(8)` on send, on answering a blocked prompt, and on a Pane switch. Behind a Settings toggle, default on. **iOS: none.** The `<input type="checkbox" switch>` hack was patched in iOS 26.5; do not ship an exploit as a feature |

## 5. Feedback

| Event | Treatment |
|---|---|
| Text sent | Clear the field immediately. A 2 px accent progress line under the composer while the POST is in flight. Success is silent — the screen revision bumping *is* the receipt |
| Send failed | Restore the text into the field, `navigator.vibrate` if Android, and a Sonner toast with **Retry**. Fail loud, succeed silent |
| Connection lost | Keep the hairline pulse for 3 s, then promote to a full-width inline banner under the header: "Reconnecting…" plus *Retry*, flipping to "Reconnected" in `--ok` for 1.5 s on recovery. Never a modal or a toast — the condition persists |
| Pane changed while you look | If pinned to the bottom, it just scrolls — that is a terminal. If the user scrolled up, show a floating "↓ New output" pill above the key bar; tapping it scrolls to bottom and re-pins |
| Status changed while you look | Crossfade the header dot over 400 ms and update the word. Put `aria-live="polite"` on the status word, never on the grid |

## 6. Type, spacing, surfaces

| Token | Value | Used for |
|---|---|---|
| `label-caps` | 11 px / 1, 600, `+0.08em`, uppercase, `--muted` | Section headers (exists) |
| Caption | 12 px / 1.35 | Timestamps, second row line |
| Body | 15 px / 1.45 | Row titles, composer, buttons |
| Title | 17 px / 1.25, 600 | Screen titles |
| Mono | 12 px / 1.35 | Grid, key caps |
| Row | 56 px two-line, 44 px one-line, 12 px vertical / 16 px horizontal padding | |
| Touch target | 44 px minimum, 8 px minimum gap | iOS 44, Android 48; 44 with gaps satisfies both |
| Section gap | 24 px above a label, 4 px below | |
| Radius | 10 px controls, 16 px cards, `9999px` chips and the tab bar | Rounded but not pill-shaped rows — pills on rows is collie's boxy look |

**Three surfaces, one accent.** `--bg` page · `--surface` *inset* controls (composer, chips,
key caps) · a new `--elevated` for things that sit *above* the page (sheets, floating tab bar,
blocked card).

| Theme | `--bg` | `--surface` (inset) | `--elevated` (raised) |
|---|---|---|---|
| Latte | base `#eff1f5` | mantle `#e6e9ef` | `#ffffff` |
| Frappé / Macchiato / Mocha | base | mantle | **surface0** (`#414559` / `#363a4f` / `#313244`) |
| light / dark | as today | as today | `#ffffff` / `#1c1c21` |

Catppuccin's own rule: mantle and crust go *behind* base; surface0–2 are what rises above it.
Today `theme.css` uses mantle for everything, which makes a sheet recede instead of lift.

The accent is spent on four things only: the primary button, the current tab or chip, the
`working` status, and the focus ring. Nothing else.

## 7. Accessibility

Measured against the current tokens:

| Finding | Fix |
|---|---|
| Latte `--muted #6c6f85` on `--bg` is **4.37:1** — below 4.5 | Use Latte `subtext0 #5c5f77` (5.53:1) |
| `text-fg/60` and `text-fg/70` in `home.tsx` fail: Latte 2.80 and 3.45, Frappé 3.99 | Delete the opacity tints; use `text-muted`. Keep opacity for non-text only |
| Latte `--warn` dot is 2.64:1 and `--ok` is 2.96:1 against `--bg` — below the 3:1 non-text floor | Never let the dot carry status alone. Print the status word on line 2 for `blocked` and `done`, which triage wants anyway; the dot then reads as redundant decoration |
| Row semantics | Put one `aria-label` on the row anchor — "claude, fix ansi parser, blocked, unseen, 4 minutes ago" — and `aria-hidden` the visual parts. Otherwise VoiceOver reads the dot's `sr-only` text mid-sentence |
| Focus order | Grid → blocked card → key bar → composer, which is already the DOM order. Keep it when the card becomes sticky: `position: sticky` does not move the node |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` must disable the push transition, the dot crossfade and the View Transition |
| Focus ring | The existing 2 px `--accent` `:focus-visible` ring is correct. Do not remove it for the key bar |

## 8. shadcn pieces

Per DECISIONS, settled — this is only the placement.

| Piece | Where |
|---|---|
| Drawer (vaul) | New Tab, New Workspace, Rename, long-press row menu, Add Host. Replaces the hand-rolled `Sheet` and brings the scroll lock and focus trap that `sheets.tsx` flags as missing |
| Dialog | Confirm close Pane only |
| Skeleton | Home loading rows, Pane grid first paint |
| Sonner | Send failure with Retry, host add failure. Nothing else |
| Hand-rolled | Status dots, rows, section headers, empty states, reconnect banner, settings rows, segmented control, composer, ANSI grid, key bar, chips, install hint |

## Do now, in the integration pass

1. Add `interactive-widget=resizes-content` to the viewport meta and the manifest, icon and `apple-mobile-web-app-capable` tags listed in `docs/UI.md`.
2. Build the floating tab bar (`Panes · Hosts · Settings`, unseen-`blocked` badge) on the three root routes; hide it on `focusin` of a text field and restore on `focusout`.
3. Rebuild the Home row to the two-line anatomy: filled/hollow dot, agent + title, second line, right-aligned relative time.
4. Add a pinned **Needs you** section above the Workspace groups holding unseen `blocked` and `done`.
5. Replace every `text-fg/60` and `text-fg/70` with `text-muted`, and set Latte `--muted: #5c5f77`.
6. Add `--elevated` to all six themes per the table, and use it for sheets, the tab bar and the blocked card.
7. Ship `web/public/taut-box.woff2` (box drawing, blocks, braille, arrows, shapes) with a `unicode-range` `@font-face` first in `--font-mono`.
8. Add the fit-width toggle labelled `80×24` (`transform: scale(clientWidth/scrollWidth)`) and the right-edge fade mask while the grid overflows.
9. Split the key bar into agent and shell presets, and make the blocked card sticky above it.
10. Add the agent chip row and bind the Pane swipe to the header, chip row and composer strip — not to the grid.

Two fields the Hub does not send yet and this design needs: `StatePane.lastLine?: string` and
`StatePane.statusChangedAt?: number`. Until they exist, fall back to `basename(cwd)` and hide
the timestamp.

## Later

- Pinch zoom on the grid; per-Pane persisted zoom.
- Powerline PUA subset, if real prompts prove unreadable.
- Swipe actions on a Home row (mark seen, close), once long-press proves the menu is used.
- Reordering the key bar from Settings, like Moshi's shortcut panels.

## Sources

- [Tab bars — Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- [Navigation bar — Material Design 3](https://m3.material.io/components/navigation-bar/guidelines)
- [Prepare for viewport resize behavior changes coming to Chrome on Android](https://developer.chrome.com/blog/viewport-resize-behavior)
- [Safari 13, mobile keyboards, and the VisualViewport API](https://tkte.ch/articles/2019/09/23/safari-13-mobile-keyboards-and-the-visualviewport-api.html)
- [Prevent content from being hidden underneath the virtual keyboard — Bram.us](https://www.bram.us/2021/09/13/prevent-items-from-being-hidden-underneath-the-virtual-keyboard-by-means-of-the-virtualkeyboard-api/)
- [ionic-framework#22299 — cannot disable iOS swipe-back in a PWA](https://github.com/ionic-team/ionic-framework/issues/22299)
- [ionic-framework#29733 — iOS PWA swipe back broken](https://github.com/ionic-team/ionic-framework/issues/29733)
- [The monospaced system UI CSS font stack](https://qwtel.com/posts/software/the-monospaced-system-ui-css-font-stack/)
- [Box drawing on the web — font fallback breaks alignment](https://velvetcache.org/2024/02/12/box-drawing-on-the-web/)
- [google/fonts#360 — Roboto Mono box-drawing characters](https://github.com/google/fonts/issues/360)
- [Nerd Fonts](https://www.nerdfonts.com/)
- [web-haptics-polyfill — iOS switch-input haptics, patched in iOS 26.5](https://github.com/doublej/web-haptics-polyfill)
- [Moshi](https://getmoshi.app)
- [Pull-to-refresh — criticism](https://en.wikipedia.org/wiki/Pull-to-refresh)
