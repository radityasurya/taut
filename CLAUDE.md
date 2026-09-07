# taut — notes for agents

Vocabulary is in `CONTEXT.md`. Use its terms (Hub, Host, Mux, Workspace, Tab, Pane, Agent,
Status, Seen, Screen, Explain). "session" is banned: it means Mux in herdr and Workspace in tmux.

Work is tracked in `docs/ROADMAP.md`: one phase at a time, tick a box only when its
verification step passed on a real device. Design lives in `docs/ARCHITECTURE.md`; reasons
behind the two irreversible choices live in `docs/adr/`.

## Gotchas the code cannot tell you

- The live herdr on this machine (`~/.config/herdr/herdr.sock`) is the developer's real
  session. Read from it freely (`session.snapshot`, `pane.read`, `agent.explain`). Send
  text or keys, close, rename, create, or focus only on a throwaway server started for tests.
- herdr closes the socket after one response. Open a connection per request; keep only the
  `events.subscribe` connection open, and send nothing else on it.
- `pane.read` may return `revision: 0`; the pane record's `revision` is the real one.
- Throwaway tmux servers must run `tmux -f /dev/null -S <sock>`; the developer's tmux
  config restores saved sessions on start.
- The Hub never calls any `*.focus` method. Seen is taut's own flag, never written to a Mux.

## Conventions

- Runtime is Bun; the package manager is pnpm. Scripts are in `package.json`.
- Add a dependency only when a few lines cannot do the job. There is no router, state
  library, or UI kit by decision.
- Terminal output is rendered as spans from `shared/ansi.ts`, never through `innerHTML`.
- Mark a deliberate shortcut with a `// ponytail:` comment naming its ceiling and upgrade path.
- Commit messages end with a `Co-Authored-By` trailer for the agent that wrote the change.
