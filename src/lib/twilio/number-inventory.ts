import "server-only";
import twilio from "twilio";

export class InventoryUnavailable extends Error {}

// Fetch again at issuance; a prior browser catalog choice is not authorization.
export async function ownedVoiceNumber(sid: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!/^PN[0-9a-fA-F]{32}$/.test(sid) || !accountSid || !/^AC[0-9a-fA-F]{32}$/.test(accountSid) || !token || /\s/.test(token)) throw new InventoryUnavailable();
  const number = await twilio(accountSid, token, { timeout: 10000, autoRetry: false }).incomingPhoneNumbers(sid).fetch();
  if (number.sid !== sid || number.accountSid !== accountSid || number.capabilities?.voice !== true || !/^\+[1-9][0-9]{1,14}$/.test(number.phoneNumber)) throw new InventoryUnavailable();
  return { accountSid, sid, phoneNumber: number.phoneNumber };
}

// Read-only account inventory, not a grant to place calls. One bounded SDK page
// per request; credentials and SDK resources must never cross the client boundary.
export async function ownedVoiceNumbers(pageNumber = 0) {
  if (!Number.isInteger(pageNumber) || pageNumber < 0 || pageNumber > 99) throw new RangeError("Invalid inventory page");
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !/^AC[0-9a-fA-F]{32}$/.test(accountSid) || !token || /\s/.test(token)) throw new InventoryUnavailable();
  const result = await twilio(accountSid, token, { timeout: 10000, autoRetry: false }).incomingPhoneNumbers.page({ pageNumber, pageSize: 50 });
  return {
    numbers: result.instances.filter(n => n.accountSid === accountSid && n.capabilities?.voice === true &&
      /^PN[0-9a-fA-F]{32}$/.test(n.sid) && /^\+[1-9][0-9]{1,14}$/.test(n.phoneNumber))
      .map(n => ({ sid: n.sid, phoneNumber: n.phoneNumber, friendlyName: n.friendlyName || n.phoneNumber })),
    // Never fetch a client/provider-supplied URL. Only fixed SDK collection pages.
    nextPage: result.nextPageUrl && pageNumber < 99 ? pageNumber + 1 : null,
    hasMore: Boolean(result.nextPageUrl), truncated: Boolean(result.nextPageUrl) && pageNumber === 99,
  };
}
