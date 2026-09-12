# 3. Interactivity comes from recognised text and mouse forwarding, gated by App profiles

Date: 2026-09-13

## Status

Accepted

## Context

tautan renders the multiplexer's screen as text (ADR 0001). Nothing on it is a control. The
maintainer wants Claude Code's prompts and status items, and TUIs such as k9s, to be usable
by touch. herdr exposes no widget tree and no terminal mode state (mouse tracking, alternate
screen, cursor), but `pane.send_input` delivers raw bytes to the pty. Verified on a throwaway
server: an SGR mouse press-and-release moves htop's selection to the tapped row and
`less --mouse` scrolls on a wheel report; the legacy X10 encoding is not recognised by
`xterm-256color` and lands as keystrokes.

## Decision

Two mechanisms, both driven by App profiles keyed on the pane's command name:

1. **Recognised text.** Hints (`key to verb`, `<key> Label`, `FnLabel`, `[key] label`),
   option lists with a cursor, Claude Code's status items and URLs become Affordances that
   send a documented key or command. Four generic patterns; anything else lives in a profile.
2. **Mouse forwarding.** For profiles that enable it (k9s, htop, btop, lazygit, nvim, less),
   a tap sends an SGR press and release at the cell, a long-press a right click, a vertical
   drag wheel reports. SGR only, never X10. A per-Pane switch overrides the profile.

Affordances render in place with a 44 px hit area and, for Hints, also as pills in the dock.
Both mechanisms are off while Wrap is on, because cell coordinates need the grid.

## Consequences

- No per-app widget parsing beyond the four Hint patterns; new apps mostly work by printing
  their keys, which most TUIs do.
- Mouse forwarding to an app without mouse mode types garbage, so the profile list is a
  safety boundary: unknown programs default to off.
- tautan cannot see an agent's input buffer; a typed command such as `/tasks` appends to an
  unsent draft. Accepted.
- A resize-aware, per-client rendering would make cell taps exact under Fit; until herdr
  offers it, Fit scaling is compensated client-side.
