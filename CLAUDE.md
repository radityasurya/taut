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
- Start throwaway herdr with isolated `HOME`, `XDG_CONFIG_HOME`, `XDG_STATE_HOME`, and
  `HERDR_SOCKET_PATH`; copy `~/.local/state/herdr/agent-detection/remote` into the isolated
  state tree when contract tests need the downloaded agent manifests.
- `HERDR_SOCKET_PATH` overrides local Mux discovery in the Hub, which is useful for tests.
- `pane.report_agent` with a `state` gives the reporter authority: herdr's screen rules still
  classify (`agent.explain` says blocked) but `agent_status` keeps the reported state. To
  simulate a blocked Agent, report `--state blocked` explicitly after printing the prompt.
- The Hub never calls any `*.focus` method. Seen is taut's own flag, never written to a Mux.
- A real Claude Code permission box matches `live_blocked_form`, not `bash_permission_prompt`.
  `live_blocked_form` has priority 980 and reads `after_last_horizontal_rule`;
  `bash_permission_prompt` has 850. Every real box ends in a rule plus
  `esc to cancel · enter to confirm`, so the first rule always wins. Never key behaviour off
  `ruleId.includes('permission')`; `shared/blocked.ts` reads the box instead.
- A throwaway herdr has no client attached, and then it does almost nothing on its own:
  `pane.updated` fires only on a structural change (title, cwd, agent status), never on raw
  output — `printf '\033]0;x\007'` (OSC title) triggers it, `echo` does not; on subscribe
  it replays a backlog of `*_created` first. It leaves
  every Pane `revision` at 0, and it never re-derives `agent_status` from the screen —
  `agent.explain` classifies on demand but does not write the result back to the snapshot.
  So a contract test or a browser drive must set Status with `pane.report_agent` and force a
  Hub re-read with `POST /api/hosts/:id/retry`. `pane.report_agent` takes
  `idle|working|blocked|unknown`; herdr turns idle-after-working on an unfocused Pane into
  `done`. Seen cannot be exercised through revisions there, because they never move.
- Chromium hands a horizontal touch drag to the nearest scroller and fires `pointercancel`,
  so `pointerup` never arrives. A swipe gesture must be built on `touchend`, not pointer
  events; the Tab strip swipe was mouse-only until this was found.

## Conventions

- Runtime is Bun; the package manager is pnpm. Scripts are in `package.json`.
- Add a dependency only when a few lines cannot do the job. There is no router, state
  library, or UI kit by decision.
- Terminal output is rendered as spans from `shared/ansi.ts`, never through `innerHTML`.
- Mark a deliberate shortcut with a `// ponytail:` comment naming its ceiling and upgrade path.
- Commit messages end with a `Co-Authored-By` trailer for the agent that wrote the change.
