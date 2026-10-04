# Outbound Twilio pilot configuration readiness

**Updated 2026-10-04 02:33 UTC: provisioned locally, calling DISABLED; not cleared for a live pilot.**

## Correction and superseding provisioning result

The original authorized account credential was usable from the original user-authorized chat. The parent verified it and this provisioning task independently authenticated with it without printing its value. The earlier bounded file-only discovery missed this authorized source; it was not an actual credential/access blocker and the user does not need to supply it again.

A dedicated outbound-only TwiML app (`AP0b7ba639c4071fcd9e61d4d129cc6f93`) and Standard signing key (identifier retained privately) are now created and verified. Server-only fields are present in ignored mode-0600 `.env.local`; the account token and new signing secret are stored outside the repository in `~/.config/crm/twilio-outpost-pilot.json` (0600). Calling remains `false`; the recipient allowlist remains unset. Existing number routing, both HighLevel apps and LC key metadata were re-read unchanged. No server restart, call, SMS, recording, inbound assignment, migration or deployment occurred.

See [PILOT_PROVISIONING_REPORT.md](PILOT_PROVISIONING_REPORT.md) for current evidence and remaining gates, including controlled activation, operational budget controls and actual Android testing. **All sections below are the historical pre-provisioning assessment, not current state; references to unavailable credentials, absent fields, unknown inventory, proposed-only wiring or creation needing approval are superseded by the report.**

The browser SDK and server lifecycle implementation exist, but no usable stored Twilio credentials were located in the bounded discovery below. No Twilio account inventory was requested, no calling flag was enabled, and no real audio was tested. This assessment writes only this document; it does not provision the pilot.

## Verified now

- Read `DIALER_CLIENT_CONTRACT.md`, `BUILD_PLAN.md`, `ACCESS_STATUS.md`, relevant implementation reports, and current token, voice, status, signature, number-inventory and call-intent source.
- `crm/.env.local` exists with mode `0600`. Its only `TWILIO_*` field is `TWILIO_CALLING_ENABLED`, verified equal to `false`. Account/auth/API/app/origin/allowlist configuration is absent from that file. The discovery process environment has no `TWILIO_*` names.
- At `2026-10-04T02:25:49Z`, read-only HTTP requests to `https://ending-personals-rooms-participating.trycloudflare.com` returned `/login` **200** and `/api/twilio/token` **503**. This proves reachability and a failing token endpoint, not authenticated SDK readiness or media delivery.
- Existing repository changes were present before this task and preserved. No source, schema, dependencies, environment, credentials, provider settings, numbers, flags or deployment were changed.

## Credential discovery: metadata only in outputs

Discovery enumerated candidate paths/permissions and parsed only environment field names/presence into output. It never printed secret values or read conversation/session logs to recover chat credentials.

Targeted roots included `~/.config`, `~/247ROI`, `/var/www/get247roi`, `~/crm`, the active Dirty Harry profile, OpenClaw configuration/workspaces and secret directories. A broader bounded home-directory filename scan (up to five directory levels, excluding dependency/build/cache/session/log directories) and top-level `/tmp` candidate-name scan found no dedicated Twilio credential file. Relevant current environment files in `~/247ROI`, `~/247-ops-dashboard`, `~/.openclaw/workspace`, `~/.openclaw/workspace-hermes/.secrets`, `~/.config/hermes`, and the default Hermes environment yielded no populated Twilio fields. Other profiles' files were not modified; their secret contents were not used.

- `crm/.env.example` has empty credential placeholders, not usable credentials.
- `~/.config/crm/supabase-oauth.json`, adjacent client registration and local-staging environment are **not Twilio credentials**.
- Vercel CLI authentication in `ACCESS_STATUS.md` is management access, **not a Twilio account token or Voice API signing key**.
- The earlier Vercel audit (`STAGING_READINESS_REPORT.md`, environment inventory) reported no project-level `TWILIO_*` names. That is historical metadata, not a fresh deployment/environment audit; shared/team settings and deployment snapshots were not proven absent.

**Bounded finding:** no safely available authorized Twilio account SID/auth-token pair or API-key secret was located, rather than a claim that no credentials exist anywhere. Prior authorized credential use recorded in `BUILD_PLAN.md` does not establish a currently reusable stored credential. Next operator action is to identify the existing secure credential file or use an approved secret-provisioning flow; never paste secrets into chat or commit them.

## Required server-only environment

All entries below are missing from the inspected local CRM environment except the disabled flag. Do not set these during this discovery task.

| Variable | Required purpose and validation |
|---|---|
| `TWILIO_ACCOUNT_SID` | Owning account (`AC` plus 32 hex characters); must match selected number, API key, TwiML app and provider callbacks. |
| `TWILIO_AUTH_TOKEN` | Current account auth token; webhook signature validation, read-only owned-number checks and fixed-resource call reconciliation. No whitespace. Not interchangeable with the API-key secret. |
| `TWILIO_API_KEY` | Existing suitable Voice access-token signing API key SID (`SK` plus 32 hex characters), associated with the same account. |
| `TWILIO_API_SECRET` | Matching API-key secret from its original secure storage; key-list metadata alone cannot supply this secret. If unavailable, replacement key creation requires separate approval. |
| `TWILIO_TWIML_APP_SID` | Dedicated outbound TwiML application SID (`AP` plus 32 hex characters), verified to have the wiring below. |
| `TWILIO_WEBHOOK_BASE_URL` | Exact public HTTPS origin (optional trailing slash; no path/query/fragment, credentials or whitespace). Must match the provider-visible callback origin; forwarded host headers are deliberately ignored. |
| `TWILIO_TEST_RECIPIENT_ALLOWLIST` | Nonempty comma-separated explicit E.164 destinations, no spaces around entries, no more than 100; must match the stored lead destination. Current code rejects missing/empty/malformed entries. |
| `TWILIO_CALLING_ENABLED` | Currently `false`; must remain off until explicit activation approval and acceptance prerequisites. Only literal `true` enables issuance/token/voice. |

`TWILIO_CALLER_ID` appears in the example environment but has **no reference in current `src`**. It is not the active caller-ID authority. The UI selects an owned voice-capable `PN…` SID; server inventory verifies it again at issuance and binding, then stores and uses its number. Do not treat a manually entered caller-ID environment value as sufficient. No `NEXT_PUBLIC_TWILIO_*` variable enables calling; all account/auth/API secrets stay server-side.

Separate runtime prerequisites remain: working Supabase login/session, a matching local/staging profile with an eligible sales role, authorized active test lead(s), and the correct guarded call-intent/lifecycle schema on the actual database serving the pilot. A reachable login page does not establish these.

## Exact outbound app wiring — proposed, not applied

Choose and retain one approved canonical HTTPS origin before provisioning. The currently reachable temporary origin would imply the following URLs, **but it has not been selected or configured in Twilio**:

| Setting | Proposed value if this temporary origin is approved |
|---|---|
| `TWILIO_WEBHOOK_BASE_URL` | `https://ending-personals-rooms-participating.trycloudflare.com` |
| Dedicated TwiML App Voice URL / method | `https://ending-personals-rooms-participating.trycloudflare.com/api/twilio/voice` / `POST` |
| Dedicated TwiML App call status callback / method | `https://ending-personals-rooms-participating.trycloudflare.com/api/twilio/status` / `POST` |

The application status callback is essential for **parent** lifecycle evidence. The server-generated `<Dial>` separately installs child Number status callbacks (`initiated`, `ringing`, `answered`, `completed`) at `/api/twilio/status?intentId=<issued-id>&event=child`, and the Dial action at the same route with `event=action`, both POST. Do not manually preconfigure a static intent ID. A child completion or Dial action alone does not prove both legs terminal. Recording is explicitly `do-not-record`; no recording callback setup is authorized.

The SDK token is outgoing-only (`incomingAllow: false`), uses the authenticated profile UUID as identity, and grants the configured outbound app. The browser supplies only the issued `IntentId` to connect. No IncomingPhoneNumber route change is needed for this outbound app arrangement.

A temporary tunnel can disappear or change origin; changing it would require coordinated server-origin/app callback updates with authorization and readback. Select a stable HTTPS staging address if the pilot must survive tunnel restarts. Do not silently reuse the current production CRM or inbound website as staging.

## Provider inventory and inbound preservation

**Current provider inventory: NOT VERIFIED (credential blocker).** Existing outbound TwiML applications, API-key metadata, account status/trial restrictions, number SID/capability, and approved-destination restrictions remain unknown. No empty-inventory conclusion is justified.

`BUILD_PLAN.md` records an earlier authenticated inventory showing one voice-capable number matching **6103003001**, with inbound Voice URL **`https://www.get247roi.com/api/voice/inbound`**. This task did not authenticate to Twilio and therefore cannot freshly attest that the current provider value is unchanged. It made no provider requests or changes.

Once a valid authorized credential is available, the next **read-only** provider step is:

1. GET the account and IncomingPhoneNumbers inventory, handling pagination; locate the exact owned number and read its fixed resource. Capture safe routing metadata and assert Voice URL equals the protected URL above. Also record Voice method/application SID/fallback/status and SMS handler metadata so unrelated automation is not overwritten.
2. GET existing Applications and Keys inventories, handling pagination; retain only IDs, friendly names, timestamps, account association and app Voice/status callback URLs/methods. Never print auth tokens, API secrets or full provider responses.
3. Identify an app already dedicated to this pilot, or document that creation/configuration is needed for a separately approved write. Identify a suitable existing API key and independently establish availability of its matching securely stored secret. Key metadata does not prove token-signing usability.
4. Re-read the **same IncomingPhoneNumber fixed resource** after inventory and assert the protected inbound Voice URL still matches. Stop on a mismatch and report it; do not repair or repoint it during read-only discovery.

No number purchase, verified-caller creation, key creation, app edits, number changes, call/SMS, credential rotation or provider write is authorized here. Existing missed-call text-back behavior remains a separate end-to-end regression gate; an unchanged Voice URL alone does not prove that behavior.

## Actionable blockers before a supervised Android test

1. **Credentials unavailable locally:** locate/provision approved server-side account SID/auth token, API-key SID/secret and app SID. Read-only inventory first; confirm inbound unchanged. Do not infer that new keys/apps are required until inventory is possible.
2. **Webhook origin/app configuration unverified:** choose the stable pilot HTTPS origin and dedicated app; separately approve any required provider updates, then read back the exact target settings. Preserve inbound routes.
3. **Runtime configuration absent and calling disabled:** provision only the intended pilot runtime, keep disabled during setup, restart/redeploy only with authorization. Authenticated token success and owned-number listing are required before any call; never log the JWT.
4. **Recipient selection and test-record setup not performed:** user supplied personal **9175727735** and Google Voice **4844249624** for discussion. Preserve these source strings; they are not already explicit E.164 values. Confirm US `+1` formatting and which endpoint is to receive the first supervised test before creating the matching authorized lead/allowlist. Ownership disclosure is not permission to place a call in this task. No recipient was added or contacted.
5. **Phone/test topology unverified:** user wants Android; exact model, browser/version, microphone permission and audio route remain to be confirmed. Prefer foreground Chrome first. If the personal Android is running the browser, calling that same handset can introduce cellular interruption rather than a clean two-way-audio test; confirm whether Google Voice forwards to it and arrange a separately answerable endpoint. Google Voice ownership does not guarantee Twilio trial verification or carrier reachability.
6. **Database/auth release gates:** verify the actual pilot database schema, profile/lead scope and persistence without treating the local rehearsal as production Supabase/RLS certification. Production migration, backup and RLS gates from the existing reports remain separate. Do not write production to unblock a local pilot.
7. **Explicit activation and bounded spend approval:** approve the recipient, supervised call window and conservative usage/stop conditions before turning on the flag. Never use sample business leads as test recipients; no live outreach release is implied.

After these are resolved and a live test is explicitly approved, test correct owned caller ID and actual two-way audio, DTMF, mute/hangup, busy/no-answer, both-leg terminal persistence, manual wrap-up/Next and no duplicate dialing. Then test permission denial, screen lock, app/tab switch, headset, incoming cellular interruption, Wi-Fi/cellular transitions and reload recovery. Unknown provider state must stay locked; no manual lease deletion or automatic redial. Recording remains off.

## Evidence boundary

Existing `BROWSER_DIALER_REPORT.md` documents source/SDK-boundary tests; parent context additionally reports the coordinated build/typecheck/lint and backend database rehearsal. This discovery did not rerun those suites and does not substitute them for phone acceptance. **No real call, SMS, recipient ringing, Android microphone session, carrier connection or two-way audio was exercised.** The deliverable is a verified readiness/blocker document, not a working outbound call certification.
