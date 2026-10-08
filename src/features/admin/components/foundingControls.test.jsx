import React from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import RemoveFoundingButton from "./RemoveFoundingButton";
import FoundingMaintenance from "./FoundingMaintenance";

const mocks = vi.hoisted(() => ({ remove: vi.fn(), maintain: vi.fn(), confirm: vi.fn(), prompt: vi.fn(), refresh: vi.fn(), error: vi.fn() }));
vi.mock("react", async (original) => ({ ...await original(), useTransition: () => [false, (fn) => fn()], useState: () => [null, vi.fn()] }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: mocks.error } }));
vi.mock("../actions/foundingActions", () => ({ removeFoundingStatus: mocks.remove, maintainFounding500: mocks.maintain }));

function buttons(node, found = []) {
  if (!React.isValidElement(node)) return found;
  if (node.type === "button") found.push(node);
  React.Children.forEach(node.props.children, (child) => buttons(child, found));
  return found;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("React", React);
  vi.stubGlobal("window", { confirm: mocks.confirm, prompt: mocks.prompt });
  mocks.prompt.mockReturnValue("");
  mocks.confirm.mockReturnValue(true);
  mocks.remove.mockResolvedValue({ ok: true });
  mocks.maintain.mockResolvedValue({ ok: true, data: { mappings: [], cleared_deleted_profiles: [] } });
});
afterEach(() => vi.unstubAllGlobals());

describe("Founding removal confirmation", () => {
  it("does not expose an action for a non-founder", () => {
    expect(RemoveFoundingButton({ userId: "target", number: null })).toBeNull();
  });
  it.each([true, false])("explains the number, scope and finalized=%s policy", async (finalized) => {
    const button = RemoveFoundingButton({ userId: "target", number: 37, name: "Alice", finalized });
    await button.props.onClick();
    expect(mocks.confirm).toHaveBeenCalledWith(expect.stringContaining("#37 from Alice"));
    expect(mocks.confirm).toHaveBeenCalledWith(expect.stringContaining("Founding status only"));
    expect(mocks.confirm).toHaveBeenCalledWith(expect.stringContaining("NOT be deleted"));
    expect(mocks.confirm).toHaveBeenCalledWith(expect.stringContaining(finalized ? "remain reserved" : "renumbered down by one"));
    expect(mocks.remove).toHaveBeenCalledWith({ userId: "target", number: 37, reason: "" });
    expect(mocks.refresh).toHaveBeenCalled();
  });
  it("honors cancellation of the reason or confirmation", () => {
    mocks.prompt.mockReturnValueOnce(null);
    const button = RemoveFoundingButton({ userId: "target", number: 37 });
    button.props.onClick();
    expect(mocks.confirm).not.toHaveBeenCalled();
    mocks.confirm.mockReturnValueOnce(false);
    button.props.onClick();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("reports a failed removal without displaying success", async () => {
    mocks.remove.mockResolvedValue({ ok: false, message: "CEO repair required first" });
    await RemoveFoundingButton({ userId: "target", number: 37 }).props.onClick();
    expect(mocks.error).toHaveBeenCalledWith("CEO repair required first");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
describe("CEO maintenance confirmation", () => {
  it("hides destructive controls after finalization", () => {
    expect(buttons(FoundingMaintenance({ finalized: true }))).toHaveLength(0);
  });
  it.each(["repair", "finalize"])("requires typed confirmation for %s", (operation) => {
    const button = buttons(FoundingMaintenance({ finalized: false }))[operation === "repair" ? 0 : 1];
    mocks.prompt.mockReturnValueOnce("wrong");
    button.props.onClick();
    expect(mocks.maintain).not.toHaveBeenCalled();
    const confirmation = operation === "repair" ? "REPAIR FOUNDING 500" : "FINALIZE FOUNDING 500";
    mocks.prompt.mockReturnValueOnce(confirmation).mockReturnValueOnce("Reviewed");
    button.props.onClick();
    expect(mocks.maintain).toHaveBeenCalledWith({ operation, confirmation, reason: "Reviewed" });
  });
});
