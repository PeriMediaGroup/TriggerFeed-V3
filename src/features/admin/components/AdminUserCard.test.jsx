import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getModerationPermissions } from "../permissions";
import AdminUserCard from "./AdminUserCard";
import RemoveFoundingButton from "./RemoveFoundingButton";

const mocks = vi.hoisted(() => ({ save: vi.fn(), confirm: vi.fn(), prompt: vi.fn() }));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal(),
  useState: (initial) => [initial, vi.fn()],
  useTransition: () => [false, (action) => action()],
}));
vi.mock("../actions/foundingActions", () => ({ removeFoundingStatus: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next/image", () => ({ default: "img" }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/features/admin/actions/moderationActions", () => ({
  updateUserProfileTypeAndMetadata: mocks.save,
  addAdminNote: vi.fn(), awardVerifiedBadge: vi.fn(), banUser: vi.fn(), muteUser: vi.fn(),
  revokeVerifiedBadge: vi.fn(), unbanUser: vi.fn(), unmuteUser: vi.fn(), updateUserRole: vi.fn(),
}));

const founder = { id: "target", display_name: "Test profile", username: "test_profile", role: "user", account_type: "user", profile_type: "member", founding_member_number: 24 };
function buttons(node, found = []) {
  if (!React.isValidElement(node)) return found;
  if (node.type === "button") found.push(node);
  React.Children.forEach(node.props.children, (child) => buttons(child, found));
  return found;
}
function render(user = founder, role = "admin", currentUserId = "actor") {
  return buttons(AdminUserCard({ user, currentUserId, permissions: getModerationPermissions(role) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("React", React);
  vi.stubGlobal("window", { confirm: mocks.confirm, prompt: mocks.prompt });
  mocks.prompt.mockReturnValue("");
  mocks.confirm.mockReturnValue(false);
  mocks.save.mockResolvedValue({ ok: true });
});

afterEach(() => vi.unstubAllGlobals());

describe("admin profile conversion interaction", () => {
  it("exposes Founding removal only to admins/CEO for founders with loaded policy state", () => {
    function findRemoval(node) {
      if (!React.isValidElement(node)) return false;
      if (node.type === RemoveFoundingButton) return true;
      return React.Children.toArray(node.props.children).some(findRemoval);
    }
    for (const role of ["admin", "ceo", "moderator", "user"]) {
      const tree = AdminUserCard({ user: founder, currentUserId: "actor", permissions: getModerationPermissions(role), foundingState: { finalized_at: null } });
      expect(findRemoval(tree)).toBe(["admin", "ceo"].includes(role));
    }
    for (const props of [
      { user: { ...founder, founding_member_number: null }, foundingState: { finalized_at: null } },
      { user: founder, foundingState: null },
    ]) {
      expect(findRemoval(AdminUserCard({ ...props, currentUserId: "actor", permissions: getModerationPermissions("admin") }))).toBe(false);
    }
  });
  it.each(["admin", "ceo"])("%s sees all three public choices", (role) => {
    const labels = render(founder, role).map((button) => button.props.children);
    expect(labels).toEqual(expect.arrayContaining(["Member", "Creator", "Organization"]));
    expect(labels).not.toContain("System");
  });
  it.each(["member", "creator"])("warns with the actual number before %s conversion and honors cancel", (profile_type) => {
    const button = render({ ...founder, profile_type, founding_member_number: 142 }).find((entry) => entry.props.children === "Organization");
    button.props.onClick();
    expect(mocks.confirm).toHaveBeenCalledWith(expect.stringContaining("Changing this profile to Organization will release Founding Member #142."));
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("saves the ordinary RPC action only after confirmation", () => {
    mocks.confirm.mockReturnValue(true);
    render().find((entry) => entry.props.children === "Organization").props.onClick();
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ targetUserId: "target", profileType: "organization" }));
  });
  it("does not warn about release for member to creator", () => {
    render().find((entry) => entry.props.children === "Creator").props.onClick();
    expect(mocks.confirm).toHaveBeenCalledWith("Change Test profile's profile type to Creator?");
  });
  it("hides conversion from moderators and preserves self/system/editorial restrictions", () => {
    for (const rendered of [
      render(founder, "moderator"), render(founder, "ceo", "target"),
      render({ ...founder, account_type: "system", profile_type: "system" }),
      render({ ...founder, account_type: "editorial" }),
    ]) {
      expect(rendered.map((button) => button.props.children)).not.toContain("Organization");
    }
  });
});
