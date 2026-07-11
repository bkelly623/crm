# A→Z Rebuild Roadmap

Goal: Build a phone-sales CRM + power dialer to run your own outbound team on a successful offer.

## Phase 0 — Foundation (Week 1)
- [ ] Choose stack: **Next.js + PostgreSQL + Prisma + Twilio** (recommended)
- [ ] Auth with roles (8 roles from audit)
- [ ] Basic layout: sidebar nav, role-based routing, notifications
- [ ] Settings page (timezone, phone, calendar ID, dialer hours)

## Phase 1 — Core sales loop (Weeks 2–4) ⭐ MVP
Build the minimum to put a rep on the phones:

- [ ] **Leads CRUD** — list, search, filters, segments (active/won/trashed/all)
- [ ] **Lead detail page** — all fields, notes, tasks, status dropdown
- [ ] **CSV import** — async job, validation, error export
- [ ] **SmartViews** — saved filters, 3 per rep
- [ ] **Power dialer** — Twilio outbound, one-at-a-time, pause/resume
- [ ] **Disposition / SDR status** — update after each call
- [ ] **Call logging** — duration, status, link to lead
- [ ] **Tasks** — create from lead, overdue grouping, complete/delete
- [ ] **Call history** — today's calls list

**Milestone:** A rep can dial 300 leads/day, disposition, and set follow-up tasks.

## Phase 2 — Appointments & pipeline (Weeks 5–6)
- [ ] Closer availability + booking UI
- [ ] Google Calendar sync
- [ ] Appointment tracking (weekly view)
- [ ] Instantly integration — follow-up sequences
- [ ] Pipeline tab — today's actions + sequence leads
- [ ] Leaderboard

## Phase 3 — Closing & money (Weeks 7–8)
- [ ] Agreement & payment (Stripe)
- [ ] AI transcript qualification
- [ ] Call recording + transcript storage
- [ ] Google Meet transcript ingestion
- [ ] My Pay view (rep commissions)

## Phase 4 — Admin & ops (Weeks 9–12)
- [ ] Executive dashboard (KPIs)
- [ ] User/team management
- [ ] Phone number management (Twilio)
- [ ] Reports & analytics (weekly commissions)
- [ ] Employee pay admin
- [ ] Schedules / availability grids
- [ ] Subscription plans

## Phase 5 — Delivery & client portal (Weeks 13–14)
- [ ] Projects module (PM workflow)
- [ ] Time logs + PM pay
- [ ] Client portal (project progress)
- [ ] Onboarding call booking

## Phase 6 — Polish
- [ ] Sales training content CMS
- [ ] Notifications system
- [ ] Mobile-responsive dialer UX
- [ ] Performance (large lead lists)

## What to decide next

1. **Do you have admin access** (or can you get it)? This unlocks the biggest unknowns.
2. **Your offer details** — what are you selling, pricing, script?
3. **Pay rules** — copy Work Optional tiers or customize?
4. **Timeline** — MVP in 4 weeks vs full parity in 14 weeks?

## Suggested first build target

**Phase 1 only** — get a working dialer + leads + tasks. That is what lets you hire your first rep and validate the offer before investing in admin/pay/projects.

When ready, say **"start Phase 1"** and I'll scaffold the Next.js project with auth, leads, and Twilio dialer.
