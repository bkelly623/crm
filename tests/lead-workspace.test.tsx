// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const m = vi.hoisted(() => ({ profile: vi.fn(), find: vi.fn(), update: vi.fn(), create: vi.fn(), complete: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: m.profile }));
vi.mock("@/lib/prisma", () => ({ prisma: { lead: { findFirst: m.find, update: m.update }, task: { create: m.create, updateMany: m.complete } } }));
import { PATCH as saveLead } from "@/app/api/leads/[id]/route";
import { POST as addTask, PATCH as completeTask } from "@/app/api/tasks/route";
import { LeadWorkspace } from "@/components/leads/lead-workspace";
const lead = { id: "lead-1", businessName: "Fixture business", contactName: "Pat", phone: null, email: null, website: null, revenue: null, location: null, industry: null, sicCode: null, market: null, type: null, sdrStatus: "no_contact", segment: "active" as const, notes: "Existing notes" };
const task = { id: "clx1234560000abcd123456789", userId: "rep", note: "Return callback", dueAt: "2026-10-10T13:00:00.000Z", status: "open" as const };
beforeEach(() => {
  vi.resetAllMocks(); m.profile.mockResolvedValue({ id: "rep", role: "sales_rep" }); m.find.mockResolvedValue(lead); m.update.mockResolvedValue(lead);
  m.create.mockImplementation(async ({ data }) => ({ ...task, ...data, userId: data.user.connect.id })); m.complete.mockResolvedValue({ count: 1 });
  // Real handlers/validation execute; transport dispatches locally, only DB/auth are mocked.
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const request = new Request(`http://localhost${url}`, init);
    if (url === "/api/leads/lead-1") return saveLead(request, { params: Promise.resolve({ id: lead.id }) });
    if (url === "/api/tasks") return init.method === "POST" ? addTask(request) : completeTask(request);
    throw new Error("Unexpected network request");
  });
});
afterEach(cleanup);
it("renders saved due times explicitly in UTC for stable server/client hydration", () => {
  render(<LeadWorkspace lead={lead} initialTasks={[task]} currentUserId="rep" />);
  expect(screen.getByText("2026-10-10 13:00 UTC")).toBeTruthy();
});
it("creates a follow-up through the real route and completes it without losing a lead draft", async () => {
  render(<LeadWorkspace lead={lead} initialTasks={[]} currentUserId="rep" />);
  fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Unsaved lead draft" } });
  fireEvent.change(screen.getByLabelText("Follow-up note"), { target: { value: "Return callback" } });
  fireEvent.change(screen.getByLabelText("Due date and time"), { target: { value: "2026-10-10T09:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Add follow-up" }));
  expect(await screen.findByText("Follow-up created.")).toBeTruthy();
  expect(m.create.mock.calls[0][0].data.dueAt.toISOString()).toBe(new Date("2026-10-10T09:00").toISOString());
  fireEvent.click(screen.getByRole("button", { name: "Complete Return callback" }));
  expect(await screen.findByText("Follow-up completed.")).toBeTruthy();
  expect(screen.queryByText("Return callback")).toBeNull();
  expect(screen.getByLabelText("Notes")).toHaveProperty("value", "Unsaved lead draft");
});
it("preserves failed follow-up input and shows creation loading/error/retry", async () => {
  render(<LeadWorkspace lead={lead} initialTasks={[]} currentUserId="rep" />);
  fireEvent.change(screen.getByLabelText("Follow-up note"), { target: { value: "Try later" } });
  fireEvent.change(screen.getByLabelText("Due date and time"), { target: { value: "2026-10-10T09:00" } });
  let fail!: (e: Error) => void;
  m.create.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
  fireEvent.click(screen.getByRole("button", { name: "Add follow-up" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Adding…" }).hasAttribute("disabled")).toBe(true));
  await waitFor(() => expect(fail).toBeTypeOf("function")); fail(new Error("offline"));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Follow-up note")).toHaveProperty("value", "Try later");
  expect(screen.getByLabelText("Due date and time")).toHaveProperty("value", "2026-10-10T09:00");
  fireEvent.click(screen.getByRole("button", { name: "Add follow-up" }));
  await screen.findByText("Follow-up created.");
  expect(screen.getByLabelText("Follow-up note")).toHaveProperty("value", "");
});
it("validates follow-ups without issuing a database write", async () => {
  render(<LeadWorkspace lead={lead} initialTasks={[]} currentUserId="rep" />);
  fireEvent.click(screen.getByRole("button", { name: "Add follow-up" }));
  await screen.findByRole("alert"); expect(m.create).not.toHaveBeenCalled();
});
it("shows pending completion then keeps the task on server failure", async () => {
  render(<LeadWorkspace lead={lead} initialTasks={[task]} currentUserId="rep" />);
  let fail!: (e: Error) => void;
  m.complete.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
  fireEvent.click(screen.getByRole("button", { name: "Complete Return callback" }));
  expect(await screen.findByText("Completing…")).toHaveProperty("disabled", true);
  await waitFor(() => expect(fail).toBeTypeOf("function")); fail(new Error("offline"));
  await screen.findByRole("alert"); expect(screen.getByText("Return callback")).toBeTruthy();
});
it("retains a task when completion affects zero rows and allows retry", async () => {
  render(<LeadWorkspace lead={lead} initialTasks={[task, { ...task, id: "other", userId: "someone-else", note: "Other owner's task" }]} currentUserId="rep" />);
  expect(screen.queryByRole("button", { name: "Complete Other owner's task" })).toBeNull();
  m.complete.mockResolvedValueOnce({ count: 0 });
  fireEvent.click(screen.getByRole("button", { name: "Complete Return callback" }));
  await screen.findByRole("alert");
  expect(screen.getByText("Return callback")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Complete Return callback" }));
  await screen.findByText("Follow-up completed.");
});
it("edits existing Notes, preserves failed drafts, retries, and shows pending/saved state", async () => {
  render(<LeadWorkspace lead={lead} initialTasks={[]} currentUserId="rep" />);
  const notes = screen.getByLabelText("Notes") as HTMLTextAreaElement;
  expect(notes.value).toBe("Existing notes");
  fireEvent.change(notes, { target: { value: "New promise" } });
  let fail!: (e: Error) => void;
  m.update.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
  fireEvent.click(screen.getByRole("button", { name: "Save lead" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Saving…" }).hasAttribute("disabled")).toBe(true));
  await waitFor(() => expect(fail).toBeTypeOf("function")); fail(new Error("offline"));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("Could not save"));
  expect(notes.value).toBe("New promise");
  fireEvent.click(screen.getByRole("button", { name: "Save lead" }));
  expect(await screen.findByText("Lead saved.")).toBeTruthy();
  expect(m.update.mock.calls[1][0].data).toEqual({ notes: "New promise" });
});
it("validates before submitting and edits existing contact/business fields", async () => {
  render(<LeadWorkspace lead={lead} initialTasks={[]} currentUserId="rep" />);
  fireEvent.change(screen.getByLabelText("Business name"), { target: { value: " " } });
  fireEvent.click(screen.getByRole("button", { name: "Save lead" }));
  expect(await screen.findByRole("alert")).toBeTruthy(); expect(m.update).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Business name"), { target: { value: "Updated business" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "pat@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Save lead" }));
  await screen.findByText("Lead saved.");
  expect(m.update.mock.calls[0][0].data).toEqual({ businessName: "Updated business", email: "pat@example.com" });
});
it("has no working Call/Book controls and uses phone-sized form controls", () => {
  const { container } = render(<LeadWorkspace lead={lead} initialTasks={[]} currentUserId="rep" />);
  expect(container.querySelector('a[href^="tel:"]')).toBeNull();
  for (const button of screen.queryAllByRole("button", { name: /Call|Book/ })) expect(button.hasAttribute("disabled")).toBe(true);
  for (const input of container.querySelectorAll("input, select, button")) expect(input.className).toContain("min-h-11");
  expect(screen.getByText(/Calling and appointment booking unavailable/)).toBeTruthy();
});
