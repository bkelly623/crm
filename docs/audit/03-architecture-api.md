# Architecture & API Surface (Inferred)

## Frontend architecture

```
React SPA (Vite)
├── React Router (/dashboard/*)
├── TanStack Query (queryKey patterns: leads, smartFilters, tasks, ...)
├── Radix UI + Tailwind-style utility classes
└── Role-based nav + route guards (Access Denied component)
```

## Dashboard routes (complete list from bundle)

```
/dashboard
/dashboard/sales-training
/dashboard/leaderboard
/dashboard/tasks
/dashboard/dialer
/dashboard/leads
/dashboard/leads/:id
/dashboard/appointments
/dashboard/pipeline
/dashboard/call-history
/dashboard/settings
/dashboard/my-pay
/dashboard/executive          [admin/manager]
/dashboard/users              [admin/manager]
/dashboard/schedules
/dashboard/projects
/dashboard/projects/:id
/dashboard/reports            [admin/manager]
/dashboard/phone-numbers      [admin/manager]
/dashboard/subscriptions      [admin]
/dashboard/employee-pay       [admin/manager]
/dashboard/test-pdf           [admin/dev]
/auth/magic-callback
```

## Backend API functions (101 fetch* identifiers)

These are the client-side API wrappers — use as a checklist for your rebuild API:

```
fetchAggregatedAvailability
fetchAggregatedOnboardingAvailability
fetchAgreementByToken
fetchAppointmentPaySummary
fetchAppointmentTracking
fetchAppointmentTrackingWeekly
fetchAppointments
fetchAvailability
fetchAvailabilitySlotsGridConfig
fetchAvailableClosers
fetchAvailablePms
fetchBookingHorizon
fetchCloserAvailabilitySlots
fetchCloserMonthly
fetchContract
fetchDailyActivity
fetchDashboard
fetchDwdStatus
fetchExecutiveMetrics
fetchFillFirstStatus
fetchIndustries
fetchIndustryCounts
fetchInstantlyCampaigns
fetchInstantlyStatus
fetchLead
fetchLeadAppointments
fetchLeadCalls
fetchLeadContracts
fetchLeadDocument
fetchLeadDocuments
fetchLeadImportJob
fetchLeadMeetTranscripts
fetchLeadTwilioBookedTranscripts
fetchLeaderboard
fetchLeaderboardUsers
fetchLeads
fetchMarkets
fetchMyPay
fetchMyTodayCalls
fetchNotifications
fetchPMDetail
fetchPMs
fetchPayAudit
fetchPaySettings
fetchPaymentStatus
fetchPhoneNumberCap
fetchPhoneNumbers
fetchPipeline
fetchPipelineSetters
fetchPipelineTemplates
fetchPmAvailability
fetchPmAvailabilitySlots
fetchPmAvailabilitySlotsGridConfig
fetchPmUsers
fetchProject
fetchProjectCalls
fetchProjectLogs
fetchProjectReminders
fetchProjects
fetchRecordingFilterReps
fetchReportHistory
fetchRescheduleTargets
fetchSalesRecordings
fetchSalesRepDetail
fetchSalesReps
fetchSalesTeam
fetchSalesTrainingContent
fetchScheduleClosers
fetchSchedules
fetchSelfAvailability
fetchSmartFilters
fetchSourceCounts
fetchSubscriptionPlans
fetchTasks
fetchTimeLogs
fetchTypeCounts
fetchUserSchedules
fetchUsers
fetchWeeklyReport
```

## Core entities (inferred ERD)

```
User ──┬── role, phone, timezone, calendarId, dialerHoursExtended
       ├── assigned PhoneNumbers (Twilio)
       └── Schedule / AvailabilitySlots

Lead ──┬── business, contact, phone, email, website, revenue, location
       ├── industry, market, type, source, sic
       ├── sdrStatus, setterId, closerId
       ├── segment: active | won | trashed
       └── SmartView membership

Call ──┬── leadId, userId, twilioCallSid, duration, status, recording
       └── transcript, disposition

Appointment ──┬── leadId, setterId, closerId, scheduledAt, timezone
              ├── qualified (AI), outcome, noShow
              └── googleCalendarEvent

Task ── leadId, userId, dueAt, note, status

PipelineAction ── leadId, actionType, dueAt (callbacks)

EmailSequence ── leadId, instantlyCampaign, status

Contract ── leadId, price, agreementToken, signedAt

Payment ── contractId, stripeStatus, amount

Project ── clientId, pmId, status, logs, reminders, timeLogs

Notification ── userId, type, read, payload
```

## Third-party integrations to plan

| Integration | Usage |
|-------------|-------|
| **Twilio** | Outbound dialer, call recording, phone numbers |
| **Instantly** | Cold email follow-up sequences |
| **Google Calendar** | Appointment sync per rep/closer |
| **Google Meet** | Closing call transcripts |
| **Stripe** | Agreement payment links |
| **OpenAI/LLM** | Appointment qualification from transcripts |
| **Email (SMTP)** | Password reset, notifications |

## Lead list segmentation rules (from bundle)

Hidden from Active segment by default:
- Trashed leads
- Closed Won leads (prevent redialing customers)
- Leads with booked appointment (skipped in dialer unless closer marks no-show)

SmartView limit: **3 per rep** (error: `smartview_cap_reached`)

## Disposition / SDR status

Observed on lead page: **No Contact** (dropdown).  
Trash criteria documented in UI (6 rules).  
Call history statuses: `completed`, `no answer`, `initiated`.

## Pay model (from sales training content)

**Setters:** $100/qualified show-up base; tiers at 10/15/20+ weekly show-ups.  
**Closers:** 30% first-month revenue.  
**Pay week:** Sat–Fri, paid following Friday.  
**PM:** Hourly payroll, semi-monthly (22nd & 8th).
