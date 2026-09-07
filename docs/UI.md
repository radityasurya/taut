# taut UI walkthrough

This doc lets you judge the look and feel of taut from mock data alone, with
no Hub, no Host, and no herdr running anywhere.

## Run with mock data

1. Run `pnpm dev:web`.
2. Open `http://127.0.0.1:5173/?mock`.

The integration TODO below must land first. Until `web/main.tsx` calls
`installMock()`, `?mock` has no effect and the app waits on a real Hub.

## Screens and states

### Home (`#/`)

Home groups Panes by Workspace. Each row shows a status Dot, the Agent name,
the title, and the Workspace path. An unseen Pane shows a brighter title.
The `dotfiles` Workspace has no Panes, so Home hides it.

### Pane (`#/pane/<key>`)

Pane shows one Pane's screen, a key bar, and a composer.

- **Grid mode**: `visible` screen, styled ANSI, fixed width.
- **Recent mode**: `recent` screen, reflowed plain text.
- **Blocked card**: appears above the key bar when Status is `blocked`.
  Shows the detection text and one button per hint key.
- **Key bar**: esc, tab, shift+tab, arrows, enter, ctrl+c.
- **Composer**: a text box that sends on Enter and appends `enter` to the keys.

Fixture Panes to try, by key:

| Pane key | Status | What it shows |
|---|---|---|
| `mbp/herdr/p1` | blocked | Claude Code permission box; Blocked card offers Yes/No |
| `mbp/herdr/p5` | blocked | An idle prompt; Blocked card offers Continue |
| `mbp/herdr/p2` | working | A running Codex Pane that gets new output every tick |
| `mbp/herdr/p4` | done | A finished Claude Pane |
| `mbp/herdr/p6`, `p7` | idle | An idle Pane at a shell prompt |
| `mbp/herdr/p3`, `mbp/tmux/p0` | unknown | A Pane herdr cannot classify |

### Sheets

Sheets slide up from the bottom and close on a backdrop tap or Escape.

- **New Tab**: label, directory, and Agent.
- **New Workspace**: directory, label, and an optional branch for a worktree.
- **Rename**: renames a Workspace, Tab, or Pane.
- **Confirm close**: confirms before it closes a Pane.

### Settings (`#/settings`)

- **Theme picker**: System, Light, Dark, and four Catppuccin themes.
- **Hosts**: lists each Host with an online Dot. Try Host `mbp` (online) and
  `vps` (offline, with an SSH timeout error).
- **Add Host**: label, SSH target, and an optional tmux target.
- **Push toggle**: turns push notifications on or off.
- **Install hint**: shows on iOS when the app is not installed, or under
  `?mock` on any device.

## What ?mock covers

`?mock` patches `window.fetch` and `EventSource` to serve state from memory:

- `GET /api/state`, `GET /api/panes/:key/screen?mode=`, `POST .../input`,
  `POST .../seen`, `GET .../explain`, `GET|PUT /api/settings`, and
  `POST /api/push/*`. Each call takes 80–200 ms, to show loading states.
- A fake `EventSource` emits `state` and `screen` events.
- Every 2500 ms, a timer appends a line to a random working Pane. 30% of
  ticks also flips a Status: `working` to `done`, or `idle` to `working`.
- Sending text appends the text plus a "… thinking" line. Sending `enter` or
  `esc` to a blocked Pane flips it to `working` or `idle`.

## Integration TODO

None of these edits are applied yet.

- [ ] `web/main.tsx`: add `import { installMock } from './mock.ts';` and call
      `installMock();` before `createRoot`. `main.tsx` already imports with
      extensions (for example `'./app.tsx'`), so match that style.
- [ ] `web/index.html`, in `<head>`: add
      `<link rel="manifest" href="/manifest.webmanifest" />`,
      `<link rel="icon" href="/icon.svg" type="image/svg+xml" />`,
      `<link rel="apple-touch-icon" href="/icon-192.png" />`, and
      `<meta name="apple-mobile-web-app-capable" content="yes" />`.
- [ ] `web/pane.tsx`: when `status === 'blocked'`, fetch
      `/api/panes/:key/explain` and render
      `<Blocked explain={…} onKeys={keys => post(paneKey, 'input', { keys })} />`
      above the key bar. Export `spanStyle` from `pane.tsx` and delete the
      copy in `blocked.tsx`.
- [ ] `web/settings.tsx`: mount `<HostList hosts={state.hosts} onAdd={…} />`,
      `<AddHostSheet …/>`, `<PushToggle …/>`, and `<InstallHint />`. Settings
      takes no `state` prop today, so `App` needs to pass one in.
- [ ] `web/home.tsx` and `web/pane.tsx`: wire `NewTabSheet`,
      `NewWorkspaceSheet`, `RenameSheet`, and `ConfirmCloseSheet` to the
      phase 7 routes.
- [ ] `Sheet`: add scroll lock and a focus trap once a sheet needs one.
