# Real-lead readiness and actual call check

Checked production `crm` / Supabase `fzjsgerhohsfxwsqkjdu` at **2026-10-04 22:26 UTC**. Repository baseline `bc15f5ecd7c0d45e93f1863d97ab2b67d27a8e71`. This task made no production writes, calls, messages, provider mutations, application source changes, build, commit or deployment.

## Outcome

- **The latest recorded test did not connect to the recipient.** All three persisted outbound child calls failed with zero duration; their browser/parent legs completed. Provider fixed-resource GETs independently confirmed all six leg statuses and parent/child associations.
- **No active leases remain (0).** Both legs are terminal for every persisted intent, and each intent has `finished_at`. Empty leases agree with authoritative terminal evidence; no agent cleared or reconciled a lease.
- **Verified real-business list count: 0. No new list created.** The five preexisting business-named leads are not verified real contacts: every stored number has a placeholder-like 555 area code and an invalid NANP exchange initial, none has website/source provenance/notes, and none matched numbers extracted from candidate public business sites. The sixth lead is the isolated Google Voice test recipient. Do not present the five as real prospects or dial-ready.

## Actual call evidence

| Intent ID | Created UTC | Child call record ID | Parent | Child | Child seconds |
| --- | --- | --- | --- | --- | --- |
| `dc31c2ee-e008-467e-a82d-965a3b677769` | 22:19:09.219 | `cmuudv5gw0001l6040ywuasck` | completed | failed | 0 |
| `b5c61083-ae0c-4f6e-bae9-10a0cd493279` | 22:19:58.923 | `cmuudw7kn0003l604t849hl20` | completed | failed | 0 |
| `15e8f15d-c4d5-4ce1-a033-63e2bf3ac2f8` | 22:20:23.635 | `cmuudwqp30005l604xpb1k24m` | completed | failed | 0 |

All dates are 2026-10-04. Latest intent finished at `22:20:30.941Z`; its provider parent duration was 2 seconds and child duration 0. The first call targeted the existing Summit HVAC record; the other two targeted Forge Fitness, not the approved Google Voice pilot record. Invalid destination formatting is a plausible contributor, not a confirmed provider error diagnosis. Fixed call-resource responses used here do not establish a specific provider error code.

A bounded Vercel CLI production-log read (`--since 1h --limit 200 --json`) returned 200 entries. Deduplicated safe route evidence includes 3 token GET/200, 3 intent POST/201, 3 voice POST/200 and 12 status POST/200, plus 2 historical reconcile POST/200. These are observed user/application traffic, not requests initiated by this audit. Poll requests returned 200. Logs establish route completion, not recipient answer or two-way audio. This bounded log window is not an exhaustive history.

The database state string remains `bound`; terminal proof is the stored parent/child statuses and `finished_at`, not an assumed `completed` intent-state label. No connected child, physical-phone audio, recording, or successful prospect conversation is claimed.

## Existing lead and ownership review

Existing authorized owner `d5a4b2ae-60d1-486b-a6d7-faddadece184` is the sole profile, retains its admin role, and matched the existing Auth identity and email without exposing email or changing access. Admin scope does not require assigning unassigned master leads; no assignments were changed.

| Master lead ID | Existing business label | Result |
| --- | --- | --- |
| `fb20ca6f-78ea-4f20-a835-6f6fedf38726` | Lakeview Dental | Invalid stored contact; no verified public-number match |
| `9b52f79b-6dcf-45b1-90a1-bfef70f46574` | BrightPath Agency | Invalid stored contact; no verified public-number match |
| `9e282a6d-a654-4fb6-a6c0-34048214f715` | Northbrook Roofing | Invalid stored contact; no verified public-number match |
| `194db0b2-c0a4-490f-ac13-afae70eada16` | Summit HVAC | Invalid stored contact; no verified public-number match |
| `785f89a5-61a6-4ae3-8b13-b74195fccd65` | Forge Fitness | Invalid stored contact; no verified public-number match |
| `pilot-571e99fa-6346-46ae-98d7-9d3c012e2cfd` | Google Voice — Test Call | Pilot, excluded from real-business selection |

All six currently have active/no_contact database flags; those flags alone do not verify contact data or calling eligibility. None was relabeled DNC, reassigned, deleted, corrected, or otherwise altered. The existing **Dialer Test** list `pilot-list-107c30fb-4431-47db-8abc-449275d999d6` and its one pilot membership remain unchanged.

Candidate source pages opened on 2026-10-04:

- https://lakeviewdentalgvr.com/
- https://brightpath.agency/
- https://northbrookroofingpro.com/
- https://summitacservices.com/service-areas/south-austin/
- https://forge-fitness.co.uk/

These are name/location research candidates, **not verified identities for the existing records**. Forge's surfaced site is UK-based, not proof of a Phoenix business. Similar names do not authorize replacing existing master contacts. No candidate page's extracted phone matched any of the five stored numbers. Public listing does not establish consent, DNC clearance, permissible calling times, carrier reputation, or spam safety.

`docs/pa-lead-sample.json` separately describes three public-source Pennsylvania businesses and explicitly says `not_imported: true` / `NOT_REVIEWED`. None exists among the six production master records. It is not an existing verified master-lead pool and was not imported or merged under this bounded membership-only task.

### Exact gap / next authorized data operation

There are **zero existing master leads with verified real-business contact details** to put into a truthful real-business calling list. Preparing one requires a separately scoped verified master-lead creation/import or contact correction, with source provenance, deduplication and eligibility review. A name-only match is insufficient. No empty list was created and labeled ready. Proposed future list name: **Real Businesses — Verified Contacts**; no list ID exists for that name from this task.

## Preservation and private evidence

Private directory: `/home/precision_focused_solutions/.config/crm/production-backups/real-leads-call-check/` (0700); every evidence file verified 0600:

- `initial.json`: private starting row snapshot of profiles, leads, lists, memberships, calls, intents and leases.
- `final-readback.json`: independent SELECT-only readback; every row in those seven tables matched the starting snapshot.
- `summary.json`: exact counts, Auth identity-match booleans, preservation checks, sanitized route counts.
- `provider-fixed-call-readback.json`: six fixed-resource provider GET results, statuses/durations and association-match booleans; no phone/account/token dump.
- `vercel-safe-routes.json`: deduplicated route/method/status/time evidence, variable intent IDs normalized.
- `vercel-raw-private.jsonl`: private bounded original CLI evidence; do not commit or publish.
- `public-source-extracts.json`: private public-source extraction results for comparison.
- `lead-verification.json`: per-record format/provenance/public-number-match results without phone values.

Final verified production counts: **6 master leads, 1 profile, 1 named list, 1 membership, 3 call intents, 3 calls, 0 leases**. No list/membership write was justified; therefore no rollback is needed. Snapshot is a private evidence export, not a tested database restore. Existing statuses, assignments, memberships and all inspected rows were preserved exactly.
