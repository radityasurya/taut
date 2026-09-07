# 2. One Hub reaches Hosts over SSH

Date: 2026-09-07

## Status

Accepted

## Context

Neither herdr nor tmux exposes a network surface; both are unix sockets. The user has several
Hosts (a VPS, an Unraid box, a desktop) and wants one screen listing all of them. Options: a
taut process per Host with the phone fanning out to each origin, or one Hub that reaches the
other Hosts over SSH, the same way herdr's own remote feature does.

## Decision

One Hub, deployed on the always-on Host. Remote Hosts are reached with the Hub user's own
SSH configuration: herdr sockets are forwarded to local sockets, tmux commands run over SSH.
The Hub's own machine is always a Host.

## Consequences

- The phone has one origin, one service worker, one push subscription.
- Remote Hosts need only sshd plus the multiplexer; no taut install there.
- The Hub holds SSH access to every Host. Keep it on a machine you already trust with that.
- If the Hub is down, every Host is invisible. Run it on the machine that is never off.
