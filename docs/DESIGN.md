# Design direction

What taut should look like and why. The research behind each call is in [UX.md](./UX.md);
the settled product decisions are in [DECISIONS.md](./DECISIONS.md). The mockups are a
design canvas you can edit: **[taut Screens](https://claude.ai/code/artifact/ee67305a-ece1-4d62-b0b7-e866752a7030)**
(source under [design/src/](./design/src/), exports under [design/](./design/)).

## In one paragraph

Linear and Notion density on a phone: one accent, three surfaces, no boxed cards, 56 px
two-line rows, small-caps section labels. Status is a dot; filled means unseen, a hollow ring
means seen. The urgent list ("Needs you") is pinned above the Workspace groups. A Pane is a
full-screen push with the multiplexer's own rendered grid, a sticky blocked card built from
herdr's detection, a key bar ordered by real use, and a composer labelled with the agent's
glyph. A floating tab bar carries the three root destinations and hides while you type.

## Screens

| Screen | Mockup | What it shows |
|---|---|---|
| Home · Mocha | ![Home](design/home-mocha.png) | Needs-you section, Workspace groups with Host suffix, offline Host row, floating tab bar with badge |
| Pane · Claude blocked | ![Pane agent](design/pane-agent.png) | Header with status word, Screen/Recent segmented control, grid-size toggle, agent chip row, grid with right-edge fade, sticky blocked card (Yes/No/↑/↓), agent key bar, composer as the agent's prompt |
| Pane · shell | ![Pane shell](design/pane-shell.png) | htop with fit-width on, shell key bar, no composer chrome |
| Settings | ![Settings](design/settings.png) | Theme chips, Hosts with online state and error, push and haptics toggles, iOS install hint, access rows |
| Home · Latte | ![Home Latte](design/home-latte.png) | Same structure in the light Catppuccin theme, with the corrected muted color |
| New Tab drawer | ![New Tab](design/sheet-new-tab.png) | Drawer (vaul) with label, directory, agent chips, one primary action |

## Rules the mockups follow

| Rule | Value |
|---|---|
| Row | 56 px two-line; 44 px one-line; 12 px vertical, 16 px horizontal padding |
| Line 1 | agent name in `--muted`, title in `--fg`; unseen rows `font-weight: 500` |
| Line 2 | blocked reason → last non-empty screen line → `basename(cwd)`; status word printed for `blocked` and `done` |
| Right column | time since the last Status change, 12 px, tabular numerals |
| Dot | 8 px; filled = unseen, 1.5 px ring = seen; `--warn` blocked, `--ok` done, `--accent` working, `--muted` idle, `--danger` offline |
| Section label | 11 px, 600, +0.08 em, uppercase, `--muted`; 24 px above, 4 px below |
| Tab bar | 52 px + safe area, inset 12 px, pill, `--elevated` at 88 %, blur, hairline; badge = unseen blocked count |
| Surfaces | `--bg` page · `--surface` inset controls (composer, key caps, chips) · `--elevated` raised (tab bar, blocked card, drawers) |
| Accent | primary button, current chip or tab, `working`, focus ring. Nothing else |
| Radius | 10 px controls, 12 px composer, 16 px cards, pill for chips and the tab bar |
| Type | caption 12/1.35 · body 15/1.45 · title 17/1.25 600 · mono 12/1.35 |
| Grid | scrolled by default, right-edge fade while it overflows; fit-width toggle scales the `<pre>` |
| Key bar | agent: `esc ↑ ↓ tab shift+tab enter ctrl+c` · shell: `esc tab ↑ ↓ ← → enter ctrl+c ctrl+d` |
| Composer | 12 px label with the agent's glyph, placeholder in the agent's voice, mic replaces send while empty |
| Blocked card | sticky above the key bar, `--elevated`, title + rule id, one-line detection excerpt, Yes/No preset then hint keys |
| Chrome left blank | status bar area (54 px) and the keyboard; the OS draws both |

## Per-theme surface values

| Theme | `--bg` | `--surface` | `--elevated` | `--muted` |
|---|---|---|---|---|
| light | `#ffffff` | `#f4f4f5` | `#ffffff` + shadow | `#71717a` |
| dark | `#0e0e11` | `#17171b` | `#1c1c21` | `#8b8b96` |
| latte | `#eff1f5` | `#e6e9ef` | `#ffffff` | `#5c5f77` (was `#6c6f85`, failed 4.5:1) |
| frappé | `#303446` | `#292c3c` | `#414559` | `#a5adce` |
| macchiato | `#24273a` | `#1e2030` | `#363a4f` | `#a5adcb` |
| mocha | `#1e1e2e` | `#181825` | `#313244` | `#a6adc8` |

## Open questions

1. Agent chip row: show it with a single Agent too, or only when a Workspace has two or more?
2. Blocked card: open by default, or collapsed to one line until tapped?
3. Theme picker: chips (as mocked) or a full list with previews?
4. Grid toggle label: the grid size (`120×48`) or the word "Fit"?

## How to update the mockups

Edit the files under `docs/design/src/`, then ask Claude to re-save the canvas, or edit the
canvas directly in the browser and press Save. Re-export the PNGs into `docs/design/` after
either.
