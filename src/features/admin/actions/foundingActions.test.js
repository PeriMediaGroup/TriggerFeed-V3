import { beforeEach, describe, expect, it, vi } from "vitest";
import { removeFoundingStatus, maintainFounding500 } from "./foundingActions";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
const userId = "f5000000-0000-0000-0000-000000000005";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "actor" } } });
  mocks.rpc.mockResolvedValue({ data: { mappings: [] }, error: null });
});
describe("Founding server actions", () => {
  it("validates input before invoking any RPC", async () => {
    expect((await removeFoundingStatus({ userId, number: 0 })).ok).toBe(false);
    expect((await removeFoundingStatus({ userId: "invalid", number: 1 })).ok).toBe(false);
    expect((await maintainFounding500({ operation: "repair", confirmation: "wrong" })).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects missing authentication", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect((await removeFoundingStatus({ userId, number: 2 })).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("passes expected number and optional reason and invalidates affected displays", async () => {
    expect((await removeFoundingStatus({ userId, number: 2, reason: " Abandoned " })).ok).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("remove_founding_500_member", { p_user_id: userId, p_expected_number: 2, p_reason: "Abandoned" });
    expect(mocks.revalidate).toHaveBeenCalledWith("/founding-500");
    expect(mocks.revalidate).toHaveBeenCalledWith("/admin/users");
    expect(mocks.revalidate).toHaveBeenCalledWith("/admin/founding-500");
    expect(mocks.revalidate).toHaveBeenCalledWith("/profiles/[userId]", "page");
  });
  it("exposes actionable gap errors but no arbitrary database details", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { message: "Founding registry has gaps or retired slots; CEO repair required first" } });
    expect((await removeFoundingStatus({ userId, number: 2 })).message).toContain("CEO repair");
    mocks.rpc.mockResolvedValueOnce({ error: { message: "private schema diagnostic" } });
    expect((await removeFoundingStatus({ userId, number: 2 })).message).not.toContain("private schema");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("preserves the database permission decision", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "42501" } });
    expect((await maintainFounding500({ operation: "repair", confirmation: "REPAIR FOUNDING 500" })).message).toContain("permission");
  });
});
