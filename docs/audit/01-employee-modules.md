# Employee Module Audit (sales_rep)

## 1. Sales Training (`/dashboard/sales-training`)

Static onboarding doc embedded in CRM. Covers:
- Company pitch (Work Optional AI automation)
- Compensation tiers for setters ($100–$250/show-up) and closers (30% first month)
- Daily KPIs: 3 appointments/day OR 300 dials
- CRM usage guide (dialer, disposition, pipeline, tasks, recordings, AI qualification)

External resources linked: Google Drive, YouTube, social profiles, SDR script Google Doc.

## 2. Leaderboard (`/dashboard/leaderboard`)

Competitive ranking among reps (not fully loaded in this session — route confirmed).

## 3. Tasks (`/dashboard/tasks`)

- Personal task list grouped by date + **Overdue** section
- Each task: datetime, note, linked lead (company name)
- Actions: **Complete**, **Delete**
- Tasks created from lead detail page
- Completed/canceled tasks are permanent (per training doc)

Observed: 6 overdue tasks at audit time.

## 4. Dashboard (`/dashboard`)

Minimal landing: "Welcome back" + role description. No widgets for sales_rep.

## 5. Dialer (`/dashboard/dialer`)

**Power dialer** — one lead at a time from a SmartView.

| Control | Behavior |
|---------|----------|
| SmartView dropdown | Filtered lead list; max 3 SmartViews per rep |
| Start Dialing | Begins auto-dial session |
| Pause | Pause without exiting session |
| Stop | Exits dialer entirely |

- Leads fetched live from SmartView conditions
- Optional fixed queue for batch dialing
- Dial window: 8 AM–5 PM lead local time (extendable to 9 PM in settings)
- Skips: trashed leads, closed-won, leads with booked appointments (unless no-show)

## 6. My Leads (`/dashboard/leads`)

Lead list with:
- Segments: **Active**, **Won**, **Trashed**, **All**
- Search, **Filters**, **My Leads** toggle
- Actions: **Start Dialing**, **New Lead**, **Upload CSV**
- CSV import with async job tracking + invalid row export

### Lead detail (`/dashboard/leads/:id`)

**Header actions:**
- Call, Book Appointment, Start Follow-Up Sequence (requires email)
- Create Agreement & Payment (closer flow)

**Lead fields observed:**
- Business name, phone (with local time), contact email, website
- Revenue, location, industry/SIC, market, type, source
- Contact name (editable), SDR status, setter assignment
- Created/updated/dialed counts

**Side panels:**
- SDR status dropdown (e.g. "No Contact")
- Setter assignment
- Date of appointment, # of reschedules
- Agreements & payments
- Transcripts & documents (auto-populated)
- Google Meet transcripts (post-close)
- Notes + searchable transcript archive

**Trash rules** (only for truly dead leads):
- Disconnected/wrong number/fax
- DNC / never contact again
- Completely unreachable phone tree
- Explicitly will never buy
- Not decision maker, no path to owner
- Wrong industry / zero fit

**Tasks on lead:** date, time, note → Add / Complete / Delete

## 7. Appointment Tracking (`/dashboard/appointments`)

- Weekly calendar view (Sat–Fri MST)
- Cards color-coded by closer outcome
- Week navigation: previous / this / next

## 8. Pipeline (`/dashboard/pipeline`)

Two sections:
1. **Today's required actions** — callbacks, follow-ups due today
2. **Automated email sequence leads** — Instantly-powered nurture

## 9. Call History (`/dashboard/call-history`)

- Today's calls list (202 calls observed on audit day)
- Each row: company, phone, contact, status (completed/no answer/initiated), duration, timestamp
- Links back to lead record

## 10. Settings (`/dashboard/settings`)

**Account (read-only except phone/calendar):**
- Full name, email, role, member since

**Editable:**
- Phone number (for dialer caller ID / routing)
- Google Calendar ID (appointment sync)
- Timezone
- Extended auto-dialer hours toggle (8–5 → 8–9 PM)

**Auth:**
- Change company email (requires current password)
- Change password
- Send reset email
