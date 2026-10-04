# Verified real-business lead import

## Production result

Completed and independently read back **2026-10-04 at 22:46 UTC** against the existing Supabase CRM project `fzjsgerhohsfxwsqkjdu`.

- Created **3 real-business master leads**, **1 named list**, and **3 memberships**. No existing master lead matched the normalized public number or normalized business name.
- List: **Allentown Plumbing — Verified Contacts**.
- List ID: `verified-list-41ac9df9-f2cd-4793-9025-71921a609c08`.
- Owner and assigned setter: existing admin `d5a4b2ae-60d1-486b-a6d7-faddadece184`. Independently matched the profile to the existing Auth identity and email; no user, role or access changes.
- Final totals: **9 master leads, 2 lists, 4 memberships**. All six preexisting leads, the pilot list/membership, statuses, assignments, call history and every preexisting row across the 12 inspected public tables remained unchanged.
- No calls, SMS, recordings, provider/configuration changes, source edits, build, commit or deployment were performed by this data-import task.

## Imported records and live official-source verification

Read both `docs/pa-lead-sample.json` and `.csv`; used fresh official-page evidence rather than trusting the historical sample alone. All three sample business identities and their original contact numbers matched current official website evidence; no replacement businesses were needed. Exact numbers were stored as E.164 and intentionally omitted from this report.

| Business | New master lead ID | Verification |
| --- | --- | --- |
| Schuler Service | `verified-d3c09531-2ded-49ac-97ae-6822b488ee6f` | Official contact page visibly publishes the business number, Allentown address and plumbing service description.[1] |
| Fred J. Moyer Plumbing Inc. | `verified-c2071910-3c79-4227-b2a5-1a59d7935c06` | Official contact page publishes the business number and Allentown address.[2] |
| Andreas Plumbing Heating & Air Conditioning | `verified-da63434a-dcc7-4d66-84f1-1e02283a39d5` | Official contact page publishes the business number and Lehighton address; a dedicated service page explicitly serves Allentown.[3][4] |

Contact-page retrieval timestamps were 2026-10-04 approximately 22:43 UTC and are retained exactly in each lead's notes and private source evidence. Andreas is accurately labeled **Serves Allentown PA**, not falsely represented as based in Allentown.[3][4]

Saved fields: exact public business phone, website, business/location/industry/market, `source=manual`, `external_source` with the official contact URL, and notes containing source URLs, retrieval timestamps and the eligibility disclaimer. Created records are `active` / `no_contact`, with zero dial count and the existing admin assigned as setter. No invented personal contact, email, revenue, consent or compliance assertion was added.

**Contact verification is not outreach authorization or legal clearance.** Public listing does not establish consent, DNC clearance, permissible calling times, permission to record, carrier reputation or successful reachability. Notes explicitly retain **outreach eligibility NOT_REVIEWED**. Active/no-contact status is an application workflow flag, not a compliance finding. The user initiates dialing; the agent did not dial. Select this exact named list to exclude the five preexisting placeholder contacts and the separate pilot recipient.

## Safeguards and independent verification

1. Read the actual current production column types/defaults and all 12 public CRM tables; verified the existing authorized admin/Auth match.
2. Saved private pre-write snapshots and an exact-ID creation journal **before** submission. Files are mode **0600** inside a **0700** directory outside Git.
3. Dedupe compared canonical E.164 phones and normalized business names against every existing lead. No matches; no merges, corrections, deletions or overwrites. All three numbers passed NANP area/exchange structure checks and matched the official visible-number telephone links and sample values.
4. One bounded transaction used a 3-second lock timeout, 15-second statement timeout and 20-second idle-in-transaction timeout. Brief write locks and exact pre-snapshot assertions prevented stale baseline writes. Explicit inserts used only the existing schema; no DDL. Transaction assertions checked exact additions and preservation of all original rows before commit.
5. A separate read-only request took the full after-snapshot. Additional fixed-ID SELECTs checked every planned lead field, list owner/name/key and exactly the three intended memberships. Checked phone/name uniqueness again, exact count deltas and unchanged preexisting rows across all 12 tables.
6. Final calls/intents remained **3 / 3**, active leases **0**. No call activity was initiated by this task. Readback verifies persistence, not authenticated UI rendering or physical-phone audio.

## Evidence, recovery and retrieval issues

Private evidence: `~/.config/crm/production-backups/verified-leads-import/` includes `before.json`, `schema.json`, `owner.json`, `journal.json`, `transaction.json`, `write-response.json`, `after.json`, `exact-readback.json`, `summary.json`, official-page text/link evidence and the citation ledger. Private operator script: `~/.config/crm/verified-import.py`. Do not commit snapshots or the private journal. This is a verified evidence export, not a full Supabase backup or tested restore.

Any future undo must be separately authorized, match the exact IDs above, and first inspect for subsequent user edits, calls, tasks or references. Do not delete later user activity or restore whole tables over current production.

The web extraction backend timed out; the actual official pages were successfully read in the browser instead. Moyer's guessed `/contact-us/` path was a 404; verification used its real linked `/contact` page. Schuler also has a differently numbered generic agent widget; the import used its repeatedly printed business contact number and matching visible telephone link, not the widget destination.[1][2] No unresolved import blocker remains.

The sample files remain unchanged as historical artifacts (`not_imported: true` reflects their original creation, not current production). This report and the private exact-ID readback document the subsequent authorized import.

## Sources

[1] https://www.schulerservice.com/contact-us
[2] https://www.fredjmoyer.com/contact
[3] https://andreasplumbing.com/contact
[4] https://andreasplumbing.com/service-area/plumbing/allentown
