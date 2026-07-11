# Work Optional CRM — Discovery Overview

**Source CRM:** https://radiant-ai.replit.app  
**Audit date:** 2026-07-02  
**Access level audited:** `sales_rep` (employee) — Brendan Kelly  
**Product name in UI:** Work Optional CRM

## Executive summary

Logged into the live CRM and mapped all employee-visible modules. Also reverse-engineered the frontend bundle to discover **admin-only routes, roles, API surface, and integrations** that are hidden from your account but present in the codebase.

Your account can use the core outbound sales stack (dialer, leads, pipeline, tasks, appointments, call history). Admin routes like `/dashboard/executive`, `/dashboard/users`, `/dashboard/reports`, etc. return **Access Denied** — but their existence and behavior are documented from the bundled frontend.

## Hermes agent status

Searched this machine for a Hermes agent (processes, binaries, config files, Cursor projects, shell history). **No agent named "hermes" was found.** There is no built-in IPC/channel from this Cursor session to a separate Hermes agent unless you have wired one up externally (SDK script, shared folder, API, etc.).

**Recommendation:** I can continue discovery directly via browser + frontend bundle analysis. If Hermes runs elsewhere, point me to its output directory or integration endpoint.

## Tech stack (inferred)

| Layer | Technology |
|-------|------------|
| Frontend | React SPA (Vite build), Radix UI, Tailwind-style utility classes |
| Hosting | Replit |
| Telephony | Twilio (power dialer, call recording, transcripts) |
| Email sequences | Instantly |
| Calendar | Google Calendar sync per rep |
| Meetings | Google Meet (transcripts stored on lead) |
| Payments | Stripe (agreement + payment links) |
| Lead data | CSV import, Mergent Intellect source field observed |

## User roles (from frontend)

| Role | Purpose |
|------|---------|
| `admin` | Full system control |
| `sales_manager` | Team oversight |
| `hiring_manager` | Hiring workflows |
| `sales_rep` | Outbound setter / appointment booker |
| `closer` | Closing calls, contracts, onboarding |
| `project_manager` | Client project delivery + hourly pay |
| `hybrid` | Sales + PM combined |
| `client` | Client portal for project progress |

## Route map (all known)

### Employee (`sales_rep`) — visible in nav
- `/dashboard/sales-training`
- `/dashboard/leaderboard`
- `/dashboard/tasks`
- `/dashboard`
- `/dashboard/dialer`
- `/dashboard/leads` (+ `/dashboard/leads/:id`)
- `/dashboard/appointments`
- `/dashboard/pipeline`
- `/dashboard/call-history`
- `/dashboard/settings`

### Admin-only — blocked for your account
- `/dashboard/executive` — executive metrics dashboard
- `/dashboard/users` — user/team management
- `/dashboard/reports` — weekly commission & team analytics
- `/dashboard/phone-numbers` — Twilio number management
- `/dashboard/subscriptions` — subscription plan management
- `/dashboard/employee-pay` — payroll / commissions admin
- `/dashboard/schedules` — team scheduling
- `/dashboard/projects` — client project management
- `/dashboard/test-pdf` — internal PDF testing

### Other roles (partial access inferred)
- `/dashboard/my-pay` — rep/PM personal pay view

## Security note

Credentials were used for this audit session only. **Rotate your password** after sharing it in chat. Do not commit credentials to the rebuild repo.
