# Admin Features — Inferred from Frontend Bundle

Your `sales_rep` account gets **Access Denied** on admin routes, but the React bundle exposes full admin UI specs. These are the gaps to fill in the rebuild.

## Admin navigation (not visible to you)

| Module | Route | Inferred purpose |
|--------|-------|------------------|
| Executive | `/dashboard/executive` | Org-wide KPIs: total users, total leads, appointments, revenue |
| Users / Team | `/dashboard/users` | Create/edit users, assign roles, manage team |
| Leads (admin) | `/dashboard/leads` | All leads, bulk import, assignment, list hygiene |
| Reports & Analytics | `/dashboard/reports` | Weekly commission reports, team performance, closer stats |
| Phone Numbers | `/dashboard/phone-numbers` | Buy/manage Twilio numbers, assign to reps |
| Subscriptions | `/dashboard/subscriptions` | Client subscription plans & billing tiers |
| Employee Pay | `/dashboard/employee-pay` | Commission payroll (Sat–Fri weeks, paid following Friday) + semi-monthly wages |
| Schedules | `/dashboard/schedules` | Closer/PM availability grids, booking rules |
| Projects | `/dashboard/projects` | Post-sale client delivery, logs, reminders, PM time tracking |
| Test PDF | `/dashboard/test-pdf` | Internal agreement/PDF generation testing |

## Admin capabilities inferred from API function names

### Executive / analytics
- `fetchExecutiveMetrics`, `fetchDashboard`, `fetchDailyActivity`
- `fetchWeeklyReport`, `fetchReportHistory`
- `fetchLeaderboard`, `fetchLeaderboardUsers`
- `fetchSalesTeam`, `fetchSalesReps`, `fetchSalesRepDetail`
- `fetchCloserMonthly`, `fetchAppointmentPaySummary`, `fetchPayAudit`

### User & team management
- `fetchUsers`, `fetchPmUsers`
- Role management for: admin, sales_manager, hiring_manager, sales_rep, closer, project_manager, hybrid, client

### Lead operations (admin-level)
- `fetchLeads`, `fetchLead`, CSV import jobs (`fetchLeadImportJob`)
- SmartViews / SmartFilters (`fetchSmartFilters`) — saved lead filters for dialer
- Industry/market/source/type counts for list segmentation
- Lead assignment, trash hygiene rules

### Telephony admin
- `fetchPhoneNumbers`, `fetchPhoneNumberCap`
- Twilio DWD (Dialer Widget?) status: `fetchDwdStatus`, `fetchFillFirstStatus`
- Call recording admin: `fetchRecordingFilterReps`, `fetchSalesRecordings`
- Re-link orphaned calls to leads

### Scheduling & booking engine
- `fetchSchedules`, `fetchScheduleClosers`, `fetchUserSchedules`
- `fetchAvailability`, `fetchAvailabilitySlots`, `fetchCloserAvailabilitySlots`
- `fetchAggregatedAvailability`, `fetchBookingHorizon`
- **A-Team closer priority:** system protects top closers' calendars (3+ appointments for next 2 days)
- `fetchRescheduleTargets`

### Appointments & qualification
- `fetchAppointmentTracking`, `fetchAppointmentTrackingWeekly`
- AI qualification of booked appointments (did prospect admit real problem?)
- Qualified show-up tracking for setter pay

### Payments & contracts
- `fetchContract`, `fetchLeadContracts`, `fetchPaymentStatus`
- `fetchSubscriptionPlans`
- Create Agreement & Payment → Stripe checkout + e-sign flow
- `fetchAgreementByToken` (client-facing sign page)

### Email automation
- `fetchInstantlyCampaigns`, `fetchInstantlyStatus`
- `fetchPipelineTemplates` — automated follow-up sequences
- Pipeline setter tracking: `fetchPipelineSetters`

### Project delivery (post-close)
- `fetchProjects`, `fetchProject`, `fetchProjectLogs`, `fetchProjectReminders`
- `fetchProjectCalls`, `fetchTimeLogs`, `fetchPMDetail`, `fetchPMs`
- Client portal role (`client`) views project progress

### Pay & commissions
- **Setter pay:** tiered per qualified show-up (10/15/20+ per week thresholds)
- **Closer pay:** 30% first-month revenue
- **PM pay:** hourly, semi-monthly (22nd & 8th)
- `fetchPaySettings`, `fetchMyPay`, `fetchEmployeePay` (admin)

## What we must design without admin UI access

These admin features need **clean-room design** based on industry patterns + bundle hints:

1. **Lead import pipeline** — CSV upload, validation, dedupe, async job status, invalid row download
2. **SmartView builder** — filter builder UI, 3-view cap for reps, unlimited for admin
3. **Commission rules engine** — configurable tiers, qualified-show definition, weekly pay periods
4. **Closer calendar algorithm** — fill-first, A-team protection, timezone-aware slots
5. **AI qualification pipeline** — transcript → qualified/unqualified → pay eligibility
6. **Agreement template system** — PDF generation, e-sign, Stripe payment collection
7. **Instantly integration** — campaign sync, sequence enrollment from lead page
8. **Phone number pool** — Twilio provisioning, per-rep assignment, cap enforcement

## Recommended way to fill admin gaps

1. **Get admin credentials** (even temporary read-only) — single highest-value step
2. **Interview you** on pay rules, booking rules, and onboarding workflow
3. **Use sales training doc** as business requirements baseline
4. **Build admin as Phase 2** after employee dialer loop works end-to-end
