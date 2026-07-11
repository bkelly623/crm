export const SDR_STATUSES = [
  { value: "no_contact", label: "No Contact" },
  { value: "follow_up_needed", label: "Follow-Up Needed" },
  { value: "callback_scheduled", label: "Callback Scheduled" },
  { value: "appointment_booked", label: "Appointment Booked" },
  { value: "not_interested", label: "Not Interested" },
  { value: "wrong_number", label: "Wrong Number" },
  { value: "dnc", label: "DNC" },
] as const;

export const TRASH_REASONS = [
  "Disconnected / wrong number / fax machine",
  "DNC or prospect said never contact me again",
  "Completely unreachable (endless phone tree)",
  "Explicitly stated they will never buy",
  "Not a decision maker, no path to owner",
  "Wrong industry / bad fit with zero possibility",
] as const;

export const SMART_VIEW_LIMIT = 3;

export const CSV_COLUMNS = [
  "business_name",
  "contact_name",
  "phone",
  "email",
  "website",
  "revenue",
  "location",
  "industry",
  "market",
  "type",
  "source",
] as const;
