# Employee (Sales Rep) — Visible Modules

Role label in UI: **Sales Rep**  
Subtitle on dashboard: *"Access the auto dialer, manage leads, book appointments, and create contracts."*

## Navigation (Sales Rep)

| Module | Route | Notes |
|--------|-------|-------|
| Sales Training | `/dashboard/sales-training` | Long-form onboarding doc in-app |
| Leaderboard | `/dashboard/leaderboard` | Team performance rankings |
| Tasks | `/dashboard/tasks` | Follow-ups grouped by date; overdue section |
| Dashboard | `/dashboard` | Welcome / quick entry |
| Dialer | `/dashboard/dialer` | Power dialer + SmartView selector |
| My Leads | `/dashboard/leads` | Lead list, filters, CSV upload |
| Appointment Tracking | `/dashboard/appointments` | Weekly Sat–Fri view, color-coded by closer outcome |
| Pipeline | `/dashboard/pipeline` | Today's actions + email sequence leads |
| Call History | `/dashboard/call-history` | Today's calls with duration + disposition |
| Settings | `/dashboard/settings` | Profile, phone, calendar, timezone, dialer hours |

## Module details

### Sales Training
Embedded sales playbook covering:
- Compensation (setter tiers: $100–$250/show-up; closer 30% first month)
- Daily expectations (3 appointments OR 300 dials)
- CRM usage instructions (disposition, pipeline, tasks, recordings, booking)

### Dialer
- **SmartView** dropdown — filtered lead lists (max 3 SmartViews per rep per bundle)
- **Start Dialing** — power dialer, one lead at a time from SmartView
- Optional fixed queue for batch dialing
- Auto-dialer hours: 8 AM–5 PM lead local time (extendable to 9 PM in settings)
- After each call: disposition required at top of screen
- Pause vs Stop (Stop exits dialer)

### My Leads
- Tabs: **Active**, **Won**, **Trashed**, **All**
- Search, **Filters**, **My Leads** toggle
- Actions: **Start Dialing**, **New Lead**, **Upload CSV**
- Lead count shown (0 assigned to this rep at audit time — company provides shared pools)

### Lead detail (`/dashboard/leads/:id`)

**Header actions:**
- Call, Book Appointment, Start Follow-Up Sequence
- Create Agreement & Payment (closer flow)

**Lead fields observed:**
- Business Name, Phone (with local time), Contact Email, Website
- Revenue, Location, Industry/SIC, Market, Type, Source
- Contact name (editable), SDR status, SDR (Setter) assignment
- Date of Appointment, # of Reschedules
- Created / Updated / Dialed count

**Sections:**
- Tasks (date, time, note; Complete/Delete — done tasks gone forever)
- Notes + transcript search
- Appointments list
- Google Meet transcripts (post-close)
- Documents (auto: cold call transcripts, qualification, closing transcripts, onboarding plans)

**Trash rules (shown in UI):**
Only trash if: wrong number/DNC/unreachable/never buy/no path to owner/wrong industry.  
*"Didn't connect" / "maybe later" → Follow-Up Needed, not Trash.*

### Pipeline
- Top: required actions today (callbacks, follow-ups)
- Bottom: leads in automated email sequence
- Instantly integration implied

### Appointment Tracking
- Weekly calendar Sat–Fri MST
- Cards color-coded by closer outcome
- Week navigation (prev/this/next)

### Tasks
- Overdue section (red)
- Grouped by due date
- Linked to lead company name
- Complete / Delete per task

### Call History
- "N calls today" badge
- Each row: company, phone, contact, status (completed/no answer/initiated), duration, time
- Links to lead detail

### Settings
- Full Name, Email (readonly), Role, Member Since
- Phone Number, Google Calendar ID, Timezone
- Extended auto-dialer hours toggle
- Change email (requires company email + password)
- Change password / Send reset email
