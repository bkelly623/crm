# Outpost outbound pilot provisioning report

**Verified: 2026-10-04 02:33:02 UTC. Outcome: provider resources and local server configuration provisioned; calling remains DISABLED. Not live-call or Android acceptance.**

## Authorized credential correction

The original user-authorized account credential was available and usable from the original chat. The parent verified it; this task recovered it in memory from the active Dirty Harry profile and independently authenticated provider requests. The earlier file-only readiness assessment missed this authorized source. No repeat credential request is necessary. No credential value, JWT or raw provider response was printed or placed in tracked source/documentation. No existing credential was rotated.

## Created and independently read back

| Resource | Name / ID |
|---|---|
| Account | Identifier retained in the private credential store |
| Dedicated TwiML app | **Outpost Pilot - Outbound Only** — `AP0b7ba639c4071fcd9e61d4d129cc6f93` |
| Dedicated Standard API key | **Outpost Pilot - Voice Signing** — identifier retained privately |
| Protected owned number | `PN80c91db5bc650456149bdf4ffbfe7d4c` |

Fresh complete inventories before creation contained two HighLevel apps, one LC API key, and one incoming number, with no Outpost key/app. The approved secure directory and local environment had no existing Outpost signing secret. Exactly one app and one key were created, without retries or failures. Final complete inventories contained three apps, two keys and the same single number; exact SID sets matched the originals plus these two new resources.

The Standard key was created through Twilio's v2010 Keys endpoint, which creates Standard keys, not Main keys. Its metadata was read back by fixed-resource GET and complete list. Its secret was additionally verified by authenticating a **read-only GET of the dedicated app** using that key. Standard keys have broader provider permissions than token signing alone; this is a dedicated signing-use credential, not a provider-enforced signing-only restricted key.

### Exact app wiring

- Canonical pilot origin: `https://ending-personals-rooms-participating.trycloudflare.com`
- Voice URL: `https://ending-personals-rooms-participating.trycloudflare.com/api/twilio/voice`, method **POST**.
- Parent call status callback: `https://ending-personals-rooms-participating.trycloudflare.com/api/twilio/status`, method **POST**.
- Voice fallback, SMS URL/fallback/status callback: empty. Public application connect and caller-ID lookup: false.
- Exact app GET verified owning account, name, URLs and methods. A key-authenticated GET separately verified account association and signing-secret usability.
- No incoming number was assigned to this app (voice or SMS). Outbound-only describes its use by the outgoing-only browser grant and lack of incoming number assignments; no provider-level outbound-only key permission is implied.
- Current code separately generates child status callbacks and Dial action URLs with issued intent association. No static intent ID or recording callback was configured.

This origin is a temporary tunnel, not a stable deployment. If it changes, a coordinated authorized update and readback of server origin/app URLs is required before activation.

## Secret storage and local runtime configuration

- Credential store: `/home/precision_focused_solutions/.config/crm/twilio-outpost-pilot.json`, verified **0600**, outside the repository. Contains recovered authorized account token, account SID, new key SID/secret, app SID, origin and disabled flag. Read in process only; never display this file.
- Runtime file: `/home/precision_focused_solutions/crm/.env.local`, verified **0600**, ignored by Git and untracked. Existing unrelated local DB and Supabase fields preserved.
- Current code variable names were checked in token, voice, webhook, number-inventory, intent and lifecycle code. Populated server-only fields: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_TWIML_APP_SID`, `TWILIO_WEBHOOK_BASE_URL`.
- `TWILIO_CALLING_ENABLED=false` retained and read back. `TWILIO_TEST_RECIPIENT_ALLOWLIST` is **unset**, not populated with discussed phone numbers. No `NEXT_PUBLIC_TWILIO*` fields exist in the file. No `TWILIO_CALLER_ID` field was added; actual caller ID remains the selected, server-verified owned PN resource.
- File readback verified credential equality without emitting values and verified unrelated parsed environment values were unchanged.
- Server was **not restarted**. The parent owns the later restart. File provisioning does not prove the existing running process loaded these values.

Secure operational artifacts (all 0600, outside repository):

- `~/.config/crm/twilio-outpost-pilot-baseline.json`: selected pre-write routing/settings metadata.
- `~/.config/crm/twilio-outpost-pilot-provisioning.json`: creation journal and resource IDs; final phase `verified_complete`.
- `~/.config/crm/twilio-outpost-pilot-verification.json`: safe verification evidence.
- Active-profile helper: `~/.hermes/profiles/dirtyharry/cache/provision_outpost_pilot.py` (no embedded secrets). It refuses a repeat run when its journal exists; reconcile IDs rather than replaying resource creation.

## Existing resources preserved

Full fixed-resource GET objects were compared in memory before and after provisioning and were identical for:

- HighLevel Outbound Dialer V2: `AP1657f2700d5b69ba1f9691da367091f9`.
- HighLevel Outbound Dialer: `APee8d64d1b1fff03391383466e63d40e0`.
- LC API Key metadata: identifier retained privately (not rotated, replaced or edited).
- Incoming number: `PN80c91db5bc650456149bdf4ffbfe7d4c`.

Protected inbound voice remains `https://www.get247roi.com/api/voice/inbound` **POST**; SMS remains `https://www.get247roi.com/api/sms/inbound` **POST**. Existing application associations, fallback/status routing and remaining number settings were unchanged. Provider POSTs were limited to creating the new app and new key. No existing resource received a write.

Unchanged routing is not proof that missed-call text-back works end-to-end or exactly once; that regression remains a separate acceptance gate.

## Actual readiness and remaining work

**Ready:** authorized provider access, dedicated verified app and usable signing secret, preserved inbound settings, ignored private server configuration on disk, disabled calling, no allowlist.

**Still outstanding before controlled activation or acceptance:**

1. Parent-controlled server restart and verification against the actual pilot runtime; authenticated owned-number listing, login/profile/lead scope, relevant local/staging schema and persistence gates. No production migration or deployment is implied.
2. Explicit authorized E.164 test recipient selection, matching eligible test lead and allowlist, supervised call window, stop conditions and activation. The user-discussed source phone strings were not normalized, added or contacted here.
3. Operational budget/usage controls, conservative pilot limits and kill-switch checks. No provider budget alerts, rate/spend enforcement or geographic-permission/account restrictions were configured or certified by this task.
4. Actual Android browser/microphone and two-way-audio acceptance, correct caller ID, DTMF, mute/hangup, busy/no-answer, both-leg terminal persistence, wrap-up/Next and duplicate prevention. Screen lock, app switching, cellular interruption, headset and Wi-Fi/cellular recovery remain untested. A separately answerable test endpoint should avoid calling the same handset running the browser.
5. Inbound missed-call text-back/opt-out regression and remaining production backup/RLS/release gates remain separate.

No calls, SMS, recipient ringing, recordings, server restart, flag activation, production migration, deployment, inbound changes or phone audio test occurred. No source/application-code changes were needed, so no build or test-suite rerun was performed for this configuration-only task. Provider readbacks and local configuration checks above are the executed verification, not simulated results.
