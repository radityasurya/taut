# 1. Render Mux screen snapshots, not a PTY

Date: 2026-09-07

## Status

Accepted

## Context

A phone needs to show what a Pane displays. Three options: attach a PTY per viewer and run a
terminal emulator in the browser (xterm.js), feed the Mux's rendered screen into xterm.js, or
render the Mux's rendered screen directly as styled text. herdr and tmux both emulate the
terminal server-side and expose the rendered grid (`pane.read`, `capture-pane -e`).

## Decision

Render the Mux's own screen snapshot as styled spans. No xterm.js, no PTY per viewer.

## Consequences

- One renderer serves every backend; the client never emulates a terminal.
- No cursor, no mouse, no reflow to phone width; the grid keeps the server's size and the
  phone scrolls or zooms. Reflowed reading uses the Mux's recent-text output instead.
- A viewer never becomes a multiplexer client, so it cannot move focus or mark tabs as seen.
- Attachment of a real PTY stays possible later as an additional view, not a replacement.
