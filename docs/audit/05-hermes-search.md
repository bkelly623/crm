# Hermes Agent — Search Results

**Requested:** Locate and communicate with agent named `hermes` on the same VM.

## Result: Not found

Searched this environment (`/Users/admin`, darwin 21.6.0):

| Check | Result |
|-------|--------|
| `which hermes` | not found |
| Process list | no hermes process |
| Files named *hermes* | none (excluding unrelated Google SDK contributor names) |
| `.cursor/` projects & config | no hermes agent config |
| Shell history | no hermes commands |
| Cursor automations | empty list |
| Cursor SDK agents | no local integration detected |

## What this means

- I **cannot** dispatch tasks to Hermes from here without an explicit integration you set up.
- This machine appears to be your **local Mac**, not necessarily the same VM where Hermes runs (if Hermes is cloud-hosted or on another host).

## How to connect Hermes (if you have it elsewhere)

1. **Shared folder:** Hermes writes audit artifacts to `~/work-optional-crm-rebuild/docs/audit/screenshots/` and I consume them here.
2. **Cursor SDK:** Script that calls `Agent.prompt(...)` with Hermes's model/config — I can help wire this in Agent mode.
3. **Tell me where Hermes lives:** SSH host, systemd service name, Docker container, or Cursor cloud agent ID.

## Work completed without Hermes

Full CRM audit performed directly:

- Logged into Work Optional CRM as Sales Rep
- Mapped all 10 visible modules + lead detail page
- Probed admin routes (Access Denied — routes confirmed)
- Downloaded & analyzed frontend bundle (~1.8MB) for routes, roles, API surface
- Created rebuild project at `~/work-optional-crm-rebuild/docs/audit/`
