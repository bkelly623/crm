# Data Model & Integrations

## Core entities (inferred)

```
User
├── role (admin | sales_manager | hiring_manager | sales_rep | closer | project_manager | hybrid | client)
├── email, name, phone, timezone
├── googleCalendarId
├── extendedDialerHours (bool)
└── twilioPhoneNumberId (assigned)

Lead
├── businessName, contactName, phone, email, website
├── revenue, location, industry/sic, market, type, source
├── segment (active | won | trashed)
├── sdrStatus, setterId, closerId
├── appointmentDate, rescheduleCount
├── dialedCount, createdAt, updatedAt
├── instantlySequenceStatus
└── qualified (AI-determined)

Call
├── leadId, userId
├── twilioCallSid, status, duration
├── recordingUrl, transcript
├── disposition
└── timestamp

Appointment
├── leadId, setterId, closerId
├── scheduledAt, timezone
├── outcome (show | no_show | closed | etc.)
├── qualified (bool, AI-reviewed)
└── googleCalendarEventId

Task
├── leadId, userId
├── dueAt, note
└── status (open | done | canceled)

SmartView / SmartFilter
├── userId, name, filterConditions (JSON)
└── used by dialer

Agreement / Contract
├── leadId, closerId
├── price, status (sent | signed | paid)
├── stripePaymentLink
└── documentUrl

Project (post-sale)
├── leadId / clientId, pmId
├── status, logs, reminders
└── timeLogs (PM hourly)

PhoneNumber
├── twilioSid, number
└── assignedUserId

PayPeriod / Commission
├── userId, weekStart, weekEnd
├── appointments, qualifiedShows, deals
└── payoutAmount
```

## Integrations

| Service | Usage |
|---------|--------|
| **Twilio** | Outbound power dialer, call recording, transcription, caller ID numbers |
| **Instantly** | Cold email follow-up sequences; pipeline nurture |
| **Google Calendar** | Rep/closer availability + appointment booking |
| **Google Meet** | Closing call transcripts attached to leads |
| **Stripe** | Agreement payment links after close |
| **OpenAI (likely)** | AI appointment qualification from call transcripts |

## Key workflows

### Outbound dial loop
1. Rep selects SmartView → Start Dialing
2. System dials next eligible lead (respects timezone window)
3. Call connects via Twilio → record + transcribe
4. Rep dispositions lead (SDR status update)
5. Optional: book appointment, start email sequence, create task, trash

### Appointment booking
1. Rep clicks Book Appointment on lead
2. System shows closer availability (A-team priority)
3. Creates calendar event + appointment record
4. Post-call AI reviews transcript → marks qualified/unqualified

### Close + handoff
1. Closer runs Google Meet closing call
2. Creates Agreement & Payment → client signs + pays via Stripe
3. Book Onboarding Call
4. Project created for PM delivery
5. Lead moves to Won segment (excluded from dialer)

### Pipeline nurture
1. Rep collects email (last resort) → Start Follow-Up Sequence
2. Lead enters Instantly campaign
3. Pipeline tab shows sequence status + required callbacks

## Frontend API layer

All data goes through `/api` (React Query). 101 `fetch*` functions identified in bundle including:
- `fetchLeads`, `fetchLead`, `fetchLeadCalls`, `fetchLeadAppointments`
- `fetchSmartFilters`, `fetchPipeline`, `fetchTasks`
- `fetchUsers`, `fetchExecutiveMetrics`, `fetchPhoneNumbers`
- `fetchInstantlyCampaigns`, `fetchPaymentStatus`, `fetchProjects`

Full list saved in `docs/audit/api-functions.txt`.
