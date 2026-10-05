# Pennsylvania public-candidate production import

Verified: 2026-10-05T22:59:36.896023+00:00.

## Result

- **List:** `PA Plumbing & HVAC — Public Candidates`
- **List ID:** `cmuvuorlo00005svpd96iafz0`
- **125 input rows reconciled: 111 new masters + 0 reused masters + 14 excluded ambiguous candidates.**
- Added one owned list and **111 memberships**; no existing memberships reused.
- **111 list members match the production next-lead database predicate**, evaluated by read-only SQL: list owned by the confirmed admin, active segment, status in `no_contact` / `follow_up_needed` / `callback_scheduled`, non-null/nonempty phone. The admin's shared `salesLeadScope` is unrestricted; no saved-view/tag/exclusion filter was applied.
- All preexisting rows across the 12 public CRM tables were independently compared and unchanged, including notes, DNC/status, assignments, lists, calls, tasks, settings, intents and leases. Existing nine masters remain unchanged; total masters after import: 120.
- No calls, call intents, provider requests, paid scraping, credential refresh, environment changes, migration, deployment or schema changes were made by this import.

These are **unverified public candidates, not verified contacts, fake/test leads, or legally cleared recipients**. Format-valid phone numbers are not proof of correct destination, business identity, consent, DNC clearance, permitted calling hours, or successful audio. Queue eligibility is a technical database check, not authorization to contact a prospect. Authenticated production UI/HTTP queue interaction and physical-phone testing were not performed by this import worker.

## Source and existing-field mapping

Input: `~/crm-lead-research/pa-service-callable-looking.json` and corresponding CSV. Both independently counted at 125 rows. JSON is the import authority because it retains nested provenance and avoids the current upload route's naive comma splitting and missing deduplication. No additional research or scraping was requested.

New records use existing `business_name`, `phone`, `website`, `location`, `industry`, `market`, `type`, `source=csv`, `external_id`, `external_source`, `notes`, assignment and queue-state fields. Published address/city/state are retained without inventing a city from coordinates; `market` explicitly identifies Pennsylvania as the OSM query region. The type is `Unverified public service candidate`. New masters have `active` / `no_contact`, zero prior dials, the confirmed existing admin as setter, and no closer. No profile was created or elevated.

Structured JSON in existing notes retains source URLs, OSM retrieval/snapshot timestamps, source records/tags, published location data, coordinates, normalized phone alternatives, original verification/consent status, attribution and license. `contact_verified_at` is explicitly null: the source retrieval date is **not** a contact-verification date.

One published website value (Union Chill Mat Company) failed the shared HTTP(S) URL validator. It was preserved verbatim in structured notes as `website_published_unvalidated`; the website field is null. It was not silently repaired or represented as validated. No additional typed fields were necessary.

### OpenStreetMap attribution and license

© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Source data is available under [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Source links and these notices are retained in each imported record. Public distribution of an adapted database must respect applicable ODbL attribution/share-alike obligations. This sanitized report is not a public phone-number export.

## Deduplication and exclusions

Checked the whole production master table and the source batch using canonical NANP phones, normalized website hostnames, and normalized business name plus locality. An additional read-only check of both alternate normalized source phone values found zero collisions with other production masters or source rows. An exact normalized name and phone match is required for automatic reuse; name variants, mismatched/shared contacts/domains and multiple matches are held for identity review rather than overwritten. Both sides of ambiguous within-source pairs were excluded, rather than accepting whichever appeared first. No matches qualified for reuse.

Two source candidates conflicted with existing production identities; twelve candidates form six ambiguous within-source groups. These may represent alternate names, distinct branches or duplicate listings; this import does not decide which.

| Source row(s) | Business / group | Disposition |
|---|---|---|
| 28 | Fred J. Moyer Plumbing | Existing-master identity ambiguity; existing verified master unchanged |
| 31 | Schuler Service, Inc. | Existing-master identity ambiguity; existing verified master unchanged |
| 37, 96 | Economy Drain Cleaning & Plumbing | Both excluded; within-source identity/contact-domain conflict |
| 48, 49 | Tiptons Electric / HVAC / Plumbing | Both excluded; within-source identity/contact-domain conflict |
| 65, 92 | Dream Team | Both excluded; within-source identity/contact-domain conflict |
| 75, 107 | Carney All Seasons | Both excluded; within-source identity/contact-domain conflict |
| 76, 80 | Haller Enterprises, Inc. | Both excluded; within-source identity/contact-domain conflict |
| 81, 102 | DiPaola Quality Climate Control | Both excluded; within-source identity/contact-domain conflict |

Private dispositions retain the exact OSM source URL for every input row. No skipped master was overwritten and no skipped candidate was added to the new list. Resolve these identity conflicts separately before any future import.

## Safety and verification evidence

1. Read current source schemas/import route, actual production column definitions, shared organizer/lead validators, list ownership and queue access rules. Matched the documented existing admin profile to the exact Auth user ID and email, both before submission and inside the transaction.
2. Generated real CUIDs through installed `cuid@3.0.0` in a private operator-tools directory, without modifying the application's dependencies. Exact planned list and lead IDs passed shared organizer, lead, catalog and membership schemas and Zod CUID validation before writes. All mapped editable values passed the shared lead-update schema.
3. Saved source checksum, all-table pre-snapshot, schema, owner proof and intended-ID journal outside Git; evidence files verified mode 0600 in a private directory. A superseded, never-submitted preparation journal was retained for audit.
4. Applied one timeout-bounded atomic transaction under brief table write locks. Full baseline and Auth-owner guards ran before insert-only writes; preservation and exact table-count guards ran before commit. Submission state is journaled before sending; uncertain submissions are never automatically retried.
5. Independently read back the full after-snapshot and exact lead IDs, all planned field values, list ownership/name and the complete membership set. Verified unchanged preexisting data across all 12 tables and exact deltas of 111 masters, one list and 111 memberships.
6. Read-only replanning against the resulting production state produced **zero new masters**, while retaining ambiguous exclusions. Existing journal states prevent accidental transaction replay.
7. Production queue-predicate SQL returned 111 eligible members. No intent issuance, provider request or call was used to test readiness.
8. Four private deduplication safety tests passed. Existing `imported-identifiers` and `list-queue-api` suites passed **75 tests**. No application code was changed by this import; no competing Next build was run.

Private evidence: `~/.config/crm/production-backups/pa-public-candidates/` contains before/after snapshots, schema, owner proof, intended-ID journal, validated-ID receipt, transaction, write response, exact readback and summary. Private operator scripts are `candidate_import.py`, `test_candidate_import.py`, `validate-candidate-ids.cjs` and `retain-invalid-source-website.py` under `~/.config/crm/`. These snapshots are evidence exports, not a full Supabase backup or a tested restoration procedure. Do not commit private evidence or phone dumps.

## Remaining scope

The 14 excluded rows require identity review. All 111 imported contacts still require appropriate verification and outreach-compliance review. Outscraper targeting and any paid request remain a separate discussion and authorization. Existing UI/dialer work by other workers was left untouched.
