import { vi } from "vitest";
import { configureLocalDatabase } from "./guard";

configureLocalDatabase();
vi.stubGlobal("fetch", vi.fn(() => { throw new Error("External fetch forbidden in local DB harness"); }));
// Auth is the only application module mocked. No Supabase client is imported.
vi.mock("@/lib/auth", () => ({ getCurrentProfile: vi.fn() }));
