# Single-recipient production pilot

User authorized activation only for their Google Voice test recipient. No agent-initiated calls, SMS or recordings.

## Scope and safeguards
- Existing production account verified against Auth and profile by exact email; existing admin role retained, no new user or role change.
- One active **Google Voice — Test Call** master lead assigned to that profile; one owned **Dialer Test** list and membership. Exact readback and all-table preservation comparison are private under `~/.config/crm/production-backups/pilot-db-readback.json`. All previously existing rows unchanged.
- Server-only production `TWILIO_TEST_RECIPIENT_ALLOWLIST` set to exactly the user-approved recipient; `TWILIO_CALLING_ENABLED=true`. Exact Vercel value readback succeeded. Redeployment is required to activate the new values.
- Added explicit TwiML `timeLimit=120` seconds, retaining `timeout=30` seconds and `record=do-not-record`. New real-handler test failed for missing timeLimit before implementation, then passed. Combined verification: **584 tests / 40 files**, lint and typecheck passed. Production build/deployment evidence is recorded separately after release.
- Existing unique user/lead leases and row locks enforce one active call per user and lead; bound leases remain held until authoritative terminal evidence. Never clear an uncertain call by retrying or auto-redialing.
- This is a limited, manual supervised pilot, **not an aggregate spend budget**. Repeated manual calls can incur further charges; there is no daily dollar cap, total-attempt cap or automatic pilot-window expiry. Keep the first test brief, then hang up; stop on unexpected destination/caller ID, missing audio or unresolved call status. Do not use for prospect outreach. Disable the server calling flag and redeploy if the pilot must be closed.
- Dedicated outbound app callbacks verified at canonical production origin; original inbound number/legacy app/key metadata unchanged. No inbound routing changes. This does not prove end-to-end missed-call text-back behavior.

## Actual user workflow
Open https://crm-sepia-xi.vercel.app and sign in with the existing account. Open Dialer; choose **Dialer Test**, click **Load Lead**, verify **Google Voice — Test Call**, select the owned caller ID, click **Prepare browser calling**, allow microphone, then **Call**. Answer Google Voice on an independently answerable device; **Hang up** after the brief audio check. Complete manual wrap-up before Next.

## Acceptance not claimed
Authenticated production walkthrough, real microphone/two-way audio, caller-ID display, physical-phone interruptions and actual both-leg callback release still require the user's manual test. Offline signing checks do not prove an authenticated production token request succeeds. No temporary tunnel is used.
