# Mobile CRM and sequential dialer requirements

## Confirmed user requirements
- Keep all contacts in one master Leads area.
- Categorize/tag leads and select named lead lists in the dialer.
- View and edit the current lead, add notes, and create follow-up tasks without leaving the dialer.
- Sequential dialing, one lead at a time, with pause/resume and wrap-up.
- Select the outgoing Twilio number manually; support optional automatic regional selection as more numbers are purchased.
- Initial user-reported number: 6103003001. Verify account ownership before enabling it.
- Save call recordings automatically and associate them with the correct call and lead.
- Fully mobile-friendly CRM and calling UI. User accepts keeping browser foregrounded and disabling screen sleep.
- Obtain real business lead samples for testing; do not call those businesses as integration tests.

## Proposed implementation guardrails
- Only allow server-verified owned/authorized caller IDs. Never trust an arbitrary caller ID from the browser.
- Manual caller-ID selection overrides automatic rules. Show the chosen number before calling; never change it during an active call.
- Automatic rules: known lead geography / configured list default / account fallback. A phone area code alone is not proof of current location. Retain a lead's prior caller ID where practical for continuity.
- Master leads with tags and named list membership or saved filters; avoid duplicating contacts per list.
- Timestamped, authored notes and a unified activity timeline.
- Explicit recording/consent policy before live calling; authenticated playback and a defined retention policy. No public recording URLs.
- Signed Twilio webhooks, idempotent callbacks, authoritative server-side call sessions and authorization checks.
- Do-not-call suppression, calling-hour eligibility and queue concurrency protection.
- Browser calls require foreground operation. Screen wake lock is best-effort, not a background-call guarantee. Handle cellular interruptions, lost networks and stale sessions.
- Live acceptance testing uses an explicitly approved test recipient, not scraped prospects.

## Current status and blockers
- Repository cloned to /home/precision_focused_solutions/crm; original macOS checkout was not found on this VM.
- Existing dialer uses tel: navigation; actual Twilio Voice SDK integration is not implemented.
- The user explicitly authorized use of the supplied credential; a read-only Twilio number inventory succeeded. Do not put account secrets in the repo, client bundle or logs. Rotation remains recommended; production needs server-side secret provisioning.
- User selected Pennsylvania; initial sample is three plumbing businesses serving Allentown, sourced from public business websites, not Google Maps. These are not cleared for calling and have not been imported.
- See BUILD_PLAN.md for the phased implementation and acceptance checklist. Existing inbound routing must be audited before changes.
- Requirements captured only; no feature implementation, deployment or live call verification claimed.
