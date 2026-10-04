# Owned caller-ID catalog and manual selector — local report

## Outcome

Implemented locally in `/home/precision_focused_solutions/crm`. **414 tests in 26 files pass; lint, production build, standalone typecheck and `git diff --check` pass.** The review dialer now has an authenticated account-owned voice-number catalog and a mobile manual **Call from** selector. **Calling is still disabled. This is not a live-dialer readiness claim.**

No production deployment, commit, dependency installation, schema/Prisma datamodel change, database operation, real provider request, purchase, routing update, call or SMS was performed by this slice. The existing dirty worktree was preserved. Build regenerated the existing local Prisma client only. Another worker's local-database work/reports are separate evidence and were not modified.

## Server contract and safety

### `GET /api/dialer/numbers?page=0`

- Existing trusted `getCurrentProfile` authentication plus shared `salesLeadScope` role policy: `admin`, `sales_manager`, `sales_rep`, `closer`, `hybrid` allowed; anonymous 401, other roles 403. Auth runs before configuration/SDK access.
- The server-configured account is the inventory scope. There is no client-supplied account, credential, role, arbitrary URL, purchase endpoint or number-update operation. All authorized sales roles can see this configured account's number catalog; this slice does not invent per-rep number assignments or multi-tenant mappings.
- Only optional `page` is accepted. Canonical integers **0–99**, default 0. Unknown/repeated keys, empty values, whitespace, leading-zero forms, decimals, negatives and out-of-range values return 400. Adapter independently checks integer/range bounds.
- Exactly one `incomingPhoneNumbers.page({ pageNumber, pageSize: 50 })` call per valid request. Read-only collection request uses the existing Twilio SDK and server-only `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`. Account SID syntax and missing/whitespace credentials fail closed with 503. No public env or fabricated caller-ID fallback.
- Ten-second SDK timeout, automatic retries disabled. Provider exceptions become generic 502 responses without logging or returning provider details. All route responses use `Cache-Control: private, no-store`; client inventory requests also use `cache: "no-store"`.
- Filter exact returned account SID and **strict boolean `capabilities.voice === true`**. Invalid PN SIDs/non-E.164 numbers are omitted. Return only `{ sid, phoneNumber, friendlyName }`; empty labels fall back to the actual returned phone number. SDK instances, credentials, account metadata and inbound routing URLs are never serialized.
- Response shape: `{ numbers, nextPage, hasMore, truncated }`. `hasMore` means the provider reports another collection page, not that another voice-capable number is guaranteed. A page with no eligible numbers may still have continuation.
- Page 99 with provider continuation returns `hasMore: true`, `nextPage: null`, `truncated: true`; never claims a complete empty catalog when traversal is capped. Otherwise `nextPage` is the next integer or null. No invented total.
- No URL supplied by either the client or provider is followed. `nextPageUrl` is inspected **only for presence**. The next request is constructed through the same fixed SDK collection with validated numeric pagination. No `getPage`, `nextPage()` or arbitrary-URL transport call.
- `import "server-only"` protects the adapter from client imports. The successful Next build verifies compatibility with its server-only boundary.

### Pagination limits

This is bounded numeric provider pagination, not snapshot/keyset pagination. Concurrent account inventory changes can move rows between pages; the UI deduplicates SIDs and provides explicit reload. The local cap allows up to 100 provider pages, each requesting 50 raw records. It is not a global rate limit: server-side per-user throttling/caching remains a future operational hardening item. No live provider pagination was exercised; the real installed SDK request construction and resource deserialization were exercised with its HTTP boundary mocked.

## UI behavior

- Visible **Call from** native select with phone-friendly minimum-44px controls, 16px text, shrinkable/wrapping layout and separate visible selected phone. It begins blank and performs no inventory request until **Load numbers**.
- Load, reload and explicit **More numbers**; no eager unbounded scan. No automatic first-number choice, hardcoded account-owned number or regional mode.
- Selection lives in a separate child component for the mounted review session. Loading/changing caller ID does not clear the lead, disposition, selected list/tag/SmartView, pause state or reviewed exclusions. Queue progression and Stop retain the caller preference. Navigation/unmount/reload of the whole page resets it; there is no persistent setting or server call intent.
- A complete catalog reload that excludes the selected number clears it with a warning. Partial inventory preserves an absent selection as **not yet verified**, instead of falsely declaring it removed. Successful reload of a listed SID refreshes its phone/label from the catalog.
- HTTP authorization/config/provider errors, network errors and malformed response payloads show a generic retry message. A remembered choice is retained but explicitly unverified; selection is disabled until an inventory read succeeds. Errors are not presented as empty success.
- Empty, partial, loading and traversal-limit states are distinct. Missing-on-complete warning clears when the user chooses another valid listed number.
- Synchronous request lock and disabled inventory controls prevent concurrent/double loads. Inventory loading does not block independent review controls. There is **no active-call state** in this review panel, so no fake active-call lock was introduced. Future real calling must add a genuine call-session lock.
- **Call remains disabled**, no `tel:` links, no Voice token fetch or outbound request added. Existing do-not-record/default-off calling safety code was untouched. The existing inbound missed-call text-back implementation and provider routing were untouched; no new live inbound validation is claimed.

## Test-first evidence

Observed targeted RED → GREEN runs before the corresponding production behavior:

| Slice | RED observed | GREEN observed |
| --- | --- | --- |
| New role-gated route | 5 failures because the route module did not exist | 5 passed |
| Missing config and minimal owned voice catalog | 7 failed / 5 passed: 200 instead of 503, empty response instead of catalog | 12 passed |
| Strict pagination and explicit continuation/cap | 11 failed / 12 passed | 23 passed |
| Malformed config, adapter bounds, malformed provider numbers/label fallback | 5 failed / 24 passed | 29 passed |
| Manual choice + independent review state | missing Call from control | 1 passed; existing disabled-call tests also passed |
| UI errors/retry and paginated stale-selection handling | 5 failed / 1 passed: no alert/More control | 6 passed |
| Pending serialization, retained-unverified error state, empty/cap distinction, response validation | 7 failed / 6 passed | 13 passed |
| Clear stale warning after choosing replacement | 1 failed / 12 passed | 13 passed |

The provider-error sanitization case was already GREEN when added because the prior missing-config slice introduced the generic catch; it is characterization, not new RED evidence. Initial SDK pagination test used `page` instead of the installed SDK's `pageNumber`; reading its declarations/implementation corrected that test and implementation before the pagination slice. The real SDK transport test subsequently verifies wire query `Page`/`PageSize`.

Additional post-GREEN characterization (not represented as test-first feature work):

- One real-SDK test mocks `RequestClient.prototype.request`, proves a single GET to the fixed account IncomingPhoneNumbers endpoint with `Page: 1, PageSize: 50`, and deserializes a synthetic provider payload through the real SDK/adapter/route. Browser fetch mocking alone would not intercept Twilio transport.
- Three jsdom integration tests dispatch the actual component's fetch into the real GET route and adapter, mocking only authentication and Twilio SDK access. They cover an owned selection and denied-role/missing-config unavailable states.
- jsdom initially could not resolve Next's build-time `server-only` alias. Vitest now resolves the already-installed Next marker; server-route tests explicitly mock that marker. No dependency added and no production guard removed.
- All fixtures are synthetic. The live number previously observed outside this task is not hardcoded anywhere in this slice.

## Full verification

Successful combined chain, exit 0:

```sh
CI=1 npm test &&
CI=1 npm run lint </dev/null &&
CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build &&
CI=1 npm run typecheck &&
git diff --check
```

- Vitest run started `23:59:54`: **414/414 tests, 26/26 files**, 15.36s. Includes unchanged calling/token/voice/webhook and review-queue suites.
- ESLint `--max-warnings 0`: passed without diagnostics.
- Prisma Client 6.19.3 generated locally; Next 15.5.27 compiled in 9.3s, checked lint/types, generated **31/31** pages, and completed traces. New API is present in built routes. Dialer first-load JS: 122 kB.
- Standalone `tsc --noEmit --incremental false`: passed.
- `git diff --check`: passed.
- Scoped source review and dangerous-code/debug/client-secret/handoff pattern scan completed. No independent reviewer subagent was available to this worker; parent review remains appropriate. No staged/commit verification claim.

## Exact owned paths

Created:

- `src/lib/twilio/number-inventory.ts`
- `src/app/api/dialer/numbers/route.ts`
- `src/components/dialer/caller-id-selector.tsx`
- `tests/dialer-numbers.test.ts`
- `tests/dialer-numbers-sdk.test.ts`
- `tests/caller-id-selector.test.tsx`
- `tests/caller-id-integration.test.tsx`
- `docs/CALLER_ID_SELECTOR_REPORT.md`

Modified:

- `src/components/dialer/dialer-panel.tsx`: only added selector import and render, preserving prior review logic/safety changes.
- `vitest.config.ts`: server-only marker alias for route/component integration tests.

Active-profile sales CRM procedural memory was updated with inventory/SDK transport/stale-selection lessons. No other profile's data was changed. Rollback only these files/hunks, not the pre-existing dirty auth/telephony/schema/workspace changes.

## Residual acceptance gates

1. **Server-authoritative call-intent binding is still required.** Before enabling any real call, the server must revalidate the selected PN SID and current account ownership/voice capability, derive the actual caller phone itself, authorize the user/lead/destination, and bind caller ID + destination + user + lead to a short-lived single-use call intent. Voice/webhook handling must consume that intent with replay/expiry/SID binding. A client dropdown value or prior catalog read is not permission to call. Do not trust a client-supplied caller number, even if it was previously listed.
2. Keep calling disabled pending real browser Voice integration, eligibility/suppression/timezone/cooldown checks, rate/spend limits, queue leases, callback idempotency and end-to-end consent/recording safeguards. Do not enable recording from this selector.
3. Runtime Twilio credentials are not configured by this worker. Missing config is intentionally an unavailable catalog, not demo data. Build success does not verify authentication/middleware, deployed env, actual account inventory, live provider pagination or real calls.
4. No authenticated real-browser or physical-phone check was performed. jsdom checks interactions/state and existing mobile classes, not actual select/keyboard geometry. Require separately approved staging validation without changing inbound routing.
5. **Optional future regional automatic selection is not enabled.** It may eventually suggest an authorized owned number using explicit regional rules, with visible manual override and callback continuity. It must never fabricate local ownership or bypass server intent validation. Manual selection remains the only implemented mode.
