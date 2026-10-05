// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { InlineLeadWork } from "@/components/dialer/inline-lead-work";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const leadId = "cm123456789012345678901234";
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
it("protects unsaved drafts from page exit and internal links", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ lead: { id: leadId, notes: "Existing" } })));
  render(<><a href="/dashboard">Home</a><InlineLeadWork leadId={leadId} onClose={vi.fn()} /></>);
  await waitFor(() => expect((screen.getByLabelText("Shared lead notes") as HTMLTextAreaElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText("Shared lead notes"), { target: { value: "Draft" } });
  const exit = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(exit); expect(exit.defaultPrevented).toBe(true);
  const navigation = new MouseEvent("click", { bubbles: true, cancelable: true });
  act(() => { screen.getByText("Home").dispatchEvent(navigation); });
  expect(navigation.defaultPrevented).toBe(true);
  expect((screen.getByLabelText("Shared lead notes") as HTMLTextAreaElement).value).toBe("Draft");
});
it.each(["notes", "task"])("a pending %s save times out without losing its draft or retrying", async kind => {
  const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => init?.method ? new Promise<Response>(() => undefined) : Response.json({ lead: { id: leadId, notes: "Previous" } }));
  vi.stubGlobal("fetch", fetcher); render(<InlineLeadWork leadId={leadId} onClose={vi.fn()} />);
  await waitFor(() => expect((screen.getByLabelText("Shared lead notes") as HTMLTextAreaElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText(kind === "notes" ? "Shared lead notes" : "Follow-up note"), { target: { value: "Retain this draft" } });
  if (kind === "task") fireEvent.change(screen.getByLabelText("Due date and time"), { target: { value: "2026-11-05T14:30" } });
  vi.useFakeTimers();
  try {
    click(kind === "notes" ? "Save notes" : "Add follow-up");
    await act(async () => { await vi.advanceTimersByTimeAsync(13000); });
    expect(screen.getByRole("alert").textContent).toMatch(/Could not confirm/);
    expect((screen.getByLabelText(kind === "notes" ? "Shared lead notes" : "Follow-up note") as HTMLTextAreaElement).value).toBe("Retain this draft");
    expect(fetcher.mock.calls.filter(([, init]) => init?.method)).toHaveLength(1);
    expect((screen.getByRole("button", { name: "Close notes & follow-up" }) as HTMLButtonElement).disabled).toBe(true);
  } finally { vi.useRealTimers(); }
});
it("StrictMode aborted initial read cannot overwrite a newer edited draft", async () => {
  let release!: (r: Response) => void;
  const fetcher = vi.fn(async () => Response.json({ lead: { id: leadId, notes: "Current" } }));
  fetcher.mockImplementationOnce(() => new Promise<Response>(r => { release = r; }));
  vi.stubGlobal("fetch", fetcher);
  render(<StrictMode><InlineLeadWork leadId={leadId} onClose={vi.fn()} /></StrictMode>);
  await waitFor(() => expect((screen.getByLabelText("Shared lead notes") as HTMLTextAreaElement).value).toBe("Current"));
  fireEvent.change(screen.getByLabelText("Shared lead notes"), { target: { value: "New draft" } });
  await act(async () => release(Response.json({ lead: { id: leadId, notes: "Stale read" } })));
  expect((screen.getByLabelText("Shared lead notes") as HTMLTextAreaElement).value).toBe("New draft");
});
it.each([401, 403, 404, 500])("load denial %s cannot overwrite existing notes", async status => {
  const fetcher = vi.fn(async () => Response.json({}, { status })); vi.stubGlobal("fetch", fetcher);
  render(<InlineLeadWork leadId={leadId} onClose={vi.fn()} />);
  await screen.findByRole("alert");
  expect((screen.getByLabelText("Shared lead notes") as HTMLTextAreaElement).disabled).toBe(true);
  click("Save notes"); expect(fetcher).toHaveBeenCalledTimes(1);
});
it("late read for an old lead cannot replace the new lead's notes", async () => {
  let release!: (r: Response) => void;
  const nextId = "cm223456789012345678901234";
  vi.stubGlobal("fetch", vi.fn((url: string) => url.endsWith(leadId) ? new Promise<Response>(r => { release = r; }) : Promise.resolve(Response.json({ lead: { id: nextId, notes: "New lead" } }))));
  const view = render(<InlineLeadWork key={leadId} leadId={leadId} onClose={vi.fn()} />);
  view.rerender(<InlineLeadWork key={nextId} leadId={nextId} onClose={vi.fn()} />);
  await waitFor(() => expect((screen.getByLabelText("Shared lead notes") as HTMLTextAreaElement).value).toBe("New lead"));
  await act(async () => release(Response.json({ lead: { id: leadId, notes: "Old lead" } })));
  expect((screen.getByLabelText("Shared lead notes") as HTMLTextAreaElement).value).toBe("New lead");
});
it("task failure retains input and does not silently retry or allow close", async () => {
  const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => init?.method === "POST" ? Response.json({}, { status: 403 }) : Response.json({ lead: { id: leadId, notes: null } }));
  vi.stubGlobal("fetch", fetcher); const close = vi.fn(); render(<InlineLeadWork leadId={leadId} onClose={close} />);
  await waitFor(() => expect((screen.getByLabelText("Shared lead notes") as HTMLTextAreaElement).disabled).toBe(false));
  click("Add follow-up"); expect(fetcher).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText("Follow-up note"), { target: { value: "Keep task" } });
  fireEvent.change(screen.getByLabelText("Due date and time"), { target: { value: "2026-11-05T14:30" } });
  await act(async () => click("Add follow-up"));
  expect(screen.getByRole("alert").textContent).toMatch(/before retrying/);
  expect((screen.getByLabelText("Follow-up note") as HTMLTextAreaElement).value).toBe("Keep task");
  click("Close notes & follow-up"); expect(close).not.toHaveBeenCalled();
  click("Discard follow-up draft"); click("Close notes & follow-up"); expect(close).toHaveBeenCalledOnce();
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
});
it("creates an owned follow-up for the held lead in device local time, retaining drafts while pending", async () => {
  let resolve!: (value: Response) => void;
  const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => init?.method === "POST" ? new Promise<Response>(r => { resolve = r; }) : Response.json({ lead: { id: leadId, notes: "Previous" } }));
  vi.stubGlobal("fetch", fetcher);
  const close = vi.fn(); render(<InlineLeadWork leadId={leadId} onClose={close} />);
  await waitFor(() => expect((screen.getByLabelText("Shared lead notes") as HTMLTextAreaElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText("Follow-up note"), { target: { value: "Send proposal" } });
  fireEvent.change(screen.getByLabelText("Due date and time"), { target: { value: "2026-11-05T14:30" } });
  expect((screen.getByRole("button", { name: "Close notes & follow-up" }) as HTMLButtonElement).disabled).toBe(true);
  click("Add follow-up");
  expect(fetcher.mock.calls.find(([, init]) => init?.method === "POST")?.[0]).toBe("/api/tasks");
  expect(JSON.parse(String(fetcher.mock.calls.find(([, init]) => init?.method === "POST")?.[1]?.body))).toEqual({ leadId, note: "Send proposal", dueAt: new Date("2026-11-05T14:30").toISOString() });
  expect((screen.getByLabelText("Follow-up note") as HTMLTextAreaElement).value).toBe("Send proposal");
  click("Close notes & follow-up"); expect(close).not.toHaveBeenCalled();
  await act(async () => resolve(Response.json({ task: { id: "task-1", leadId } }, { status: 201 })));
  expect((screen.getByLabelText("Follow-up note") as HTMLTextAreaElement).value).toBe("");
  expect(screen.getByText(/Follow-up created/)).toBeTruthy();
  click("Close notes & follow-up"); expect(close).toHaveBeenCalledOnce();
});
