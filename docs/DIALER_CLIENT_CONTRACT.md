# Controlled pilot dialer client contract (v1)

Backend source integration is implemented and exercised with signed offline provider payloads, mocked SDK HTTP transport and real guarded PostgreSQL; see CALL_LIFECYCLE_REPORT.md for verification. No live calls or environment activation. Existing inbound `https://www.get247roi.com/api/voice/inbound` MUST remain unchanged. This contract is stable for the separate browser SDK slice.

## Browser flow

1. Authenticated session + sales role required. Fetch owned numbers (`GET /api/dialer/numbers`) and outgoing token (`GET /api/twilio/token`). Server calling flag must equal `true`, server-only explicit test-recipient allowlist must contain stored destination. No client value enables calling.
2. `GET /api/dialer/intents` recovers your active lease, or most recent intent if no lease. Returns `{ intent: null | Status }`. No cross-user access, even managers. Never auto-redial on reconnect. Polling failure/unknown state holds the UI.
3. Explicit user Call -> `POST /api/dialer/intents` strict JSON `{leadId, callerIdSid}`. 201 `{intent:{id,expiresAt},callingAvailable:true,recording:"do-not-record"}`. 401 unauthenticated; 403 role; 400 invalid payload; 503 disabled; 409 generic unavailable/conflict. One reservation per user and per lead across tabs/users. Reservation expires after 60s **only if never bound**.
4. Connect Voice SDK exactly once with `device.connect({params:{IntentId:intent.id}})`. Do not send To, caller ID, user/lead IDs or recording flags. Provider supplies authenticated From=`client:<profile UUID>`, account and CallSid. Signed voice rechecks role, scope, phone, allowlist and owned number immediately before single-use consumption; returns Dial from stored authority with recording explicitly off. A duplicate voice request never returns another Dial.
5. SDK events are UI hints only. Parent leg `accept` is NOT proof the recipient answered. `GET /api/dialer/intents/:id` returns `{intent:Status}` from server-authoritative child lifecycle. On disconnect/cancel/error/tab loss, enter holding/reconciling, not ready/next. Local mute/DTMF/hangup may use SDK; disconnect doesn't release the lease.
6. `POST /api/dialer/intents/:id/reconcile` with no body performs provider **GETs only**, never dials or cancels. 200 `{intent:Status}`. 409 `{error:"Call state remains uncertain"}` means KEEP LOCKED; GET current status afterward if needed. 404 unknown/not yours; 401/403 auth/role; 400 malformed id. Works while calling disabled so existing calls can settle. It releases an expired never-bound reservation or verifies parent plus exactly one associated child. Missing/ambiguous child, active leg, mismatched provider identity, errors or timeouts never authorize a new call.
7. Only `intent.canStartNewIntent === true` authorizes leaving the server hold. Successful calls still require explicit human wrap-up then explicit Next/Call. Never auto-redial, auto-advance or interpret SDK disconnect, expiry of bound intent, HTTP error or parent-only terminal as terminal proof.

## Status shape

`{id,leadId,state,expiresAt,parentStatus,childStatus,finishedAt,locked,canStartNewIntent,recording}`

- `state`: `issued | dialing | ringing | connected | uncertain | terminal | expired | canceled`.
- `parentStatus` / `childStatus`: null or Twilio `queued | initiated | ringing | in-progress | completed | busy | no-answer | failed | canceled`.
- `finishedAt`: ISO timestamp or null. `expiresAt`: original ISO reservation expiry; it does NOT expire a bound call.
- `locked`: persisted lease exists. `canStartNewIntent`: no lease AND persisted terminal/expired/canceled proof. Never infer it yourself from individual statuses.
- `recording`: always `do-not-record`. No consent toggle or recording attachment is available in this pilot.
- Only owner may see status; own in-flight call remains observable even if lead assignment changes. Response does not expose destination, caller/account secrets, recording URLs or provider diagnostics.
- Private no-store responses. Status is a snapshot, not permission to bypass issuance races; next issuance can still return 409.

## Provider wiring required before activation (NOT changed by this task)

Dedicated outbound TwiML App Voice POST -> canonical `/api/twilio/voice`; **application call status callback POST -> `/api/twilio/status`** for parent events. TwiML itself installs Number status and Dial action URLs with signed intent association. Do not repoint an IncomingPhoneNumber voice/inbound handler.

Number child callbacks + Dial action persist child state. Dial action returns Hangup; action is NOT parent terminal proof. App parent completed callback or REST reconciliation must confirm parent terminal too. Signature validation uses exact configured HTTPS origin and raw path/query, never forwarded authority. All DB accounting derives from issued intent, not browser/custom leadId/userId fields.

## Operational limitations

No approved recipient, provisioned Twilio credentials, live activation or actual audio test supplied. Missing-child/ambiguous provider state deliberately remains locked: no force-unlock endpoint or speculative expiry. Stop and obtain provider/operator investigation; never delete leases manually to retry. Recording callbacks always reject, even signed, because approved consent/storage is not implemented. Spend/rate controls, outreach eligibility, production schema/RLS/backup approval and real-device/mobile interruption tests remain release gates.
