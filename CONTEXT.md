# tautan — domain glossary

tautan shows coding agents running inside terminal multiplexers on remote machines, from a
phone. This file is the vocabulary. It holds no implementation detail.

## Terms

- **Hub** — the tautan process a phone talks to. One Hub can see many Hosts.
- **Host** — a machine the Hub can reach: the machine the Hub runs on, or a remote one.
- **Mux** — one multiplexer server instance on a Host, identified by its socket.
  A herdr session or a tmux server. A Host can have several Muxes.
- **Workspace** — the top grouping inside a Mux. herdr: workspace. tmux: session.
- **Tab** — a grouping inside a Workspace. herdr: tab. tmux: window.
- **Pane** — one terminal inside a Tab. Same word in herdr and tmux.
- **Agent** — a coding agent (Claude Code, Codex, Pi, …) detected in a Pane.
- **Status** — the Agent's state as reported by the Mux:
  `idle` (finished and the user has looked), `working`, `blocked` (waiting for an approval
  or an answer), `done` (finished while nobody was looking), `unknown` (present, not classified).
  tmux reports only `unknown`.
- **Seen** — tautan's own flag on a Pane: the phone displayed this Pane after its last Status
  change. Seen is layered on Status and is never written back to the Mux.
- **Screen** — what a Pane currently shows. Two views: the **visible** grid, and **recent**
  output as reflowed text.
- **Explain** — the Mux's account of why a Pane is `blocked`: the rule that matched, the
  region it looked at, and the keys the prompt offers.
- **Affordance** — a tappable region tautan derived from a Screen, together with the input it
  sends when tapped: a key, a typed command, or a mouse click at a cell.
- **Hint** — a key-to-action pair an app printed on its own Screen (`esc to cancel`,
  `<d> Describe`, `F9Kill`). Hints are the main source of Affordances.
- **App profile** — what tautan knows about a program by its command name: whether mouse
  forwarding is on, extra Hint patterns, static keys and quick replies. Claude Code, Pi,
  k9s and htop are App profiles; an unknown program gets the generic profile.
- **Mouse forwarding** — turning a tap on the grid into a mouse report the app understands
  (SGR press and release). Only on for App profiles that enable it.

## Banned words

- **session** — means Mux in herdr and Workspace in tmux. Use the level you mean.
- **read** as a noun — reserved for fetching Screen text. Use Seen for the user-side flag.
