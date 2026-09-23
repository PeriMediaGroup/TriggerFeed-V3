import { describe, expect, it } from "vitest";
import { canChangeProfileType, EDITABLE_PROFILE_TYPES, foundingReleaseWarning } from "./profileTypeTransitions";

import { getModerationPermissions } from "./permissions";

const member = { account_type: "user", profile_type: "member", founding_member_number: 24 };

describe("admin profile type controls", () => {
  it("lets both admin and CEO manage profile types without expanding role management", () => {
    expect(getModerationPermissions("admin").canManageProfileTypes).toBe(true);
    expect(getModerationPermissions("admin").canManageRoles).toBe(false);
    expect(getModerationPermissions("ceo").canManageProfileTypes).toBe(true);
    expect(getModerationPermissions("moderator").canManageProfileTypes).toBe(false);
    expect(getModerationPermissions("user").canManageProfileTypes).toBe(false);
  });
  it("offers exactly the three public types", () => {
    expect(EDITABLE_PROFILE_TYPES).toEqual(["member", "creator", "organization"]);
    for (const profile_type of EDITABLE_PROFILE_TYPES) {
      expect(canChangeProfileType({ ...member, profile_type })).toBe(true);
    }
  });
  it.each(["system", "editorial", "bot"])("protects %s accounts regardless of public type", (account_type) => {
    expect(canChangeProfileType({ ...member, account_type })).toBe(false);
  });
  it("protects system profiles, deleted profiles, and missing classifications", () => {
    expect(canChangeProfileType({ ...member, profile_type: "system" })).toBe(false);
    expect(canChangeProfileType({ ...member, is_deleted: true })).toBe(false);
    expect(canChangeProfileType({ profile_type: "member" })).toBe(false);
  });
  it.each(["member", "creator"])("warns before releasing a %s's actual number", (profile_type) => {
    const warning = foundingReleaseWarning({ ...member, profile_type, founding_member_number: 137 }, "organization");
    expect(warning).toContain("Changing this profile to Organization will release Founding Member #137.");
    expect(warning).toContain("available to another eligible member or creator");
    expect(warning).not.toContain("#24");
  });
  it("does not warn for member/creator transitions or profiles without numbers", () => {
    expect(foundingReleaseWarning(member, "creator")).toBe("");
    expect(foundingReleaseWarning({ ...member, profile_type: "creator" }, "member")).toBe("");
    expect(foundingReleaseWarning({ ...member, founding_member_number: null }, "organization")).toBe("");
    expect(foundingReleaseWarning({ ...member, profile_type: "organization" }, "member")).toBe("");
  });
});
