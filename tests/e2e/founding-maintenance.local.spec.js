import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";

// Deliberately opt-in: never use the normal app environment or a remote endpoint.
test.skip(process.env.FOUNDING_LOCAL_E2E !== "1", "Requires the isolated local Founding validation stack.");
const api = "http://127.0.0.1:55321";
const origin = "http://127.0.0.1:3105";
const password = "Founding-local-fixture-123!";
const accounts = {};

function sql(statement) {
  return execFileSync("docker", ["exec", "-i", "-e", "PGPASSWORD=postgres", "supabase_db_tf_founding_validation",
    "psql", "-X", "-U", "supabase_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"],
  { input: statement, encoding: "utf8" }).trim();
}

async function login(page, name) {
  await page.goto(`${origin}/login`);
  await page.getByLabel("Email", { exact: true }).fill(`founding-e2e-${name}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL(`${origin}/`, { timeout: 30000 });
}

async function respond(page, plan, click) {
  const seen = [];
  const handler = async (dialog) => {
    const response = plan[seen.length];
    seen.push({ type: dialog.type(), message: dialog.message() });
    if (!response) return dialog.dismiss();
    if (response.accept === false) await dialog.dismiss();
    else await dialog.accept(response.text);
  };
  page.on("dialog", handler);
  try {
    await click();
    await expect.poll(() => seen.length).toBe(plan.length);
    for (let i = 0; i < plan.length; i++) {
      expect(seen[i].type).toBe(plan[i].type);
      if (plan[i].contains) expect(seen[i].message).toContain(plan[i].contains);
    }
  } finally { page.off("dialog", handler); }
}

test.beforeAll(async () => {
  if (process.env.FOUNDING_LOCAL_SUPABASE_URL !== api) throw new Error("Only the isolated loopback API is allowed");
  // Refuse to reset any database with non-fixture users.
  expect(sql("select count(*) from auth.users where email not like 'founding-e2e-%@example.test';")).toBe("0");
  sql(`begin;
    alter table public.founding_500_settings disable trigger set_founding_500_settings_updated_at;
    update public.founding_500_settings set finalized_at=null,is_auto_assignment_enabled=false;
    alter table public.founding_500_settings enable trigger set_founding_500_settings_updated_at;
    delete from public.moderation_actions;
    delete from auth.users where email like 'founding-e2e-%@example.test';
    delete from public.founding_member_numbers;
    commit;`);
  const service = createClient(api, process.env.FOUNDING_LOCAL_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const name of ["ceo", "admin", "moderator", "none", "alice", "bob", "charlie", "delta"]) {
    const { data, error } = await service.auth.admin.createUser({
      email: `founding-e2e-${name}@example.test`, password, email_confirm: true,
      user_metadata: { username: `founding_e2e_${name}`, display_name: `Founding Test ${name}`, dob: "1980-01-01", profile_type: name === "bob" ? "creator" : "member" },
    });
    if (error) throw new Error(`Local fixture ${name}: ${error.message}`);
    accounts[name] = data.user.id;
  }
  for (const role of ["ceo", "admin", "moderator"]) sql(`update public.profiles set role='${role}' where id='${accounts[role]}';`);
  for (const [index, name] of ["alice", "bob", "charlie", "delta"].entries()) {
    sql(`update public.profiles set founding_member_number=${index + 1} where id='${accounts[name]}';`);
  }
  sql(`insert into public.posts(user_id,body) values('${accounts.bob}','Preserve Founding browser test content');`);
});

test("authenticated Founding maintenance works from confirmation through persisted state", async ({ browser, page }, testInfo) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await test.step("anonymous and ordinary/moderator users cannot open management", async () => {
    await page.goto(`${origin}/admin/founding-500`);
    await expect(page).toHaveURL(`${origin}/welcome`);
    for (const name of ["none", "moderator"]) {
      const context = await browser.newContext();
      const deniedPage = await context.newPage();
      await login(deniedPage, name);
      await deniedPage.goto(`${origin}/admin/founding-500`);
      await expect(deniedPage).toHaveURL(`${origin}/`);
      await expect(deniedPage.getByRole("button", { name: "Remove Founding Status" })).toHaveCount(0);
      await context.close();
    }
  });

  await test.step("Admin sees members, numbers and removal controls, but no CEO maintenance", async () => {
    await login(page, "admin");
    await page.goto(`${origin}/admin/founding-500`);
    await expect(page.getByRole("heading", { name: "Founding 500", exact: true })).toBeVisible();
    await expect(page.getByText("Assigned: 4 / 500", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: "#2 · Founding Test bob" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove Founding Status" })).toHaveCount(4);
    await expect(page.getByText("CEO maintenance — repair and finalization")).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("admin-founders.png"), fullPage: true });
    await page.goto(`${origin}/admin/users?q=founding_e2e_none`);
    await expect(page.getByRole("heading", { name: "Founding Test none" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove Founding Status" })).toHaveCount(0);
  });

  await test.step("cancel leaves all numbers and audit untouched; confirmed removal saves reason and refreshes", async () => {
    await page.goto(`${origin}/admin/founding-500`);
    const bob = page.locator("article").filter({ has: page.getByRole("heading", { name: "#2 · Founding Test bob" }) });
    const button = bob.getByRole("button", { name: "Remove Founding Status" });
    await respond(page, [{ type: "prompt", text: "Cancelled reason" }, { type: "confirm", accept: false, contains: "Founding #2" }], () => button.click());
    expect(sql("select count(*) from public.moderation_actions where action_type='founding_removed';")).toBe("0");
    expect(sql(`select founding_member_number from public.profiles where id='${accounts.bob}';`)).toBe("2");
    await respond(page, [{ type: "prompt", text: "Abandoned local fixture" }, { type: "confirm", contains: "Later Founding members will be renumbered down by one" }], () => button.click());
    await expect(page.getByText("Founding status removed.", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "#2 · Founding Test charlie" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "#3 · Founding Test delta" })).toBeVisible();
    expect(sql(`select profile_type||':'||coalesce(founding_member_number::text,'none') from public.profiles where id='${accounts.bob}';`)).toBe("creator:none");
    expect(sql(`select count(*) from public.posts where user_id='${accounts.bob}' and body='Preserve Founding browser test content';`)).toBe("1");
    expect(sql("select reason from public.moderation_actions where action_type='founding_removed';")).toBe("Abandoned local fixture");
    await page.goto(`${origin}/admin/users?q=founding_e2e_bob`);
    await expect(page.getByRole("heading", { name: "Founding Test bob" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove Founding Status" })).toHaveCount(0);
    await page.goto(`${origin}/founding-500`);
    await expect(page.getByText("Open enrollment:", { exact: false })).toBeVisible();
    await expect(page.getByLabel("Founding member number 3")).toBeVisible();
  });

  const ceoContext = await browser.newContext();
  const ceo = await ceoContext.newPage();
  ceo.on("pageerror", (error) => pageErrors.push(error.message));
  await login(ceo, "ceo");

  await test.step("CEO repair rejects incorrect typed confirmation then compacts the controlled gap", async () => {
    // Create a released gap through the supported conversion RPC, not raw ledger edits.
    sql(`select set_config('request.jwt.claim.sub','${accounts.admin}',false); set role authenticated;
      select public.update_profile_type_and_metadata('${accounts.charlie}','organization'); reset role;`);
    await ceo.goto(`${origin}/admin/founding-500`);
    await expect(ceo.getByRole("alert")).toContainText("CEO repair");
    await ceo.getByText("CEO maintenance — repair and finalization", { exact: true }).click();
    const repair = ceo.getByRole("button", { name: "Repair Founding Sequence" });
    await respond(ceo, [{ type: "confirm", contains: "current number order" }, { type: "prompt", text: "wrong" }], () => repair.click());
    expect(sql(`select founding_member_number from public.profiles where id='${accounts.delta}';`)).toBe("3");
    expect(sql("select count(*) from public.moderation_actions where action_type='founding_repaired';")).toBe("0");
    await respond(ceo, [{ type: "confirm" }, { type: "prompt", text: "REPAIR FOUNDING 500" }, { type: "prompt", text: "Local gap repair" }], () => repair.click());
    await expect(ceo.getByText("Founding registry repaired.", { exact: true })).toBeVisible();
    await expect(ceo.getByRole("heading", { name: "#2 · Founding Test delta" })).toBeVisible();
    await expect(ceo.getByText(`${accounts.delta}: #3 → #2`, { exact: true })).toBeVisible();
    expect(sql("select jsonb_array_length(metadata->'previous_ledger') from public.moderation_actions where action_type='founding_repaired';")).toBe("3");
    await ceo.screenshot({ path: testInfo.outputPath("ceo-repair-result.png"), fullPage: true });
  });

  await test.step("finalization requires confirmation and exact phrase; finalized removal retires without shifting", async () => {
    const finalize = ceo.getByRole("button", { name: "Finalize Founding 500" });
    await respond(ceo, [{ type: "confirm", accept: false, contains: "Permanently close enrollment" }], () => finalize.click());
    expect(sql("select finalized_at is null from public.founding_500_settings;")).toBe("t");
    await respond(ceo, [{ type: "confirm" }, { type: "prompt", text: "wrong" }], () => finalize.click());
    expect(sql("select finalized_at is null from public.founding_500_settings;")).toBe("t");
    await respond(ceo, [{ type: "confirm" }, { type: "prompt", text: "FINALIZE FOUNDING 500" }, { type: "prompt", text: "Local closure" }], () => finalize.click());
    await expect(ceo.getByText("Founding program finalized.", { exact: true })).toBeVisible();
    await expect(ceo.getByRole("button", { name: "Repair Founding Sequence" })).toHaveCount(0);
    await expect(ceo.getByRole("button", { name: "Finalize Founding 500" })).toHaveCount(0);
    const alice = ceo.locator("article").filter({ has: ceo.getByRole("heading", { name: "#1 · Founding Test alice" }) });
    await respond(ceo, [{ type: "prompt", text: "" }, { type: "confirm", contains: "other members will not be renumbered" }], () => alice.getByRole("button", { name: "Remove Founding Status" }).click());
    await expect(ceo.getByText("Founding status removed.", { exact: true })).toBeVisible();
    await expect(ceo.getByRole("heading", { name: "#2 · Founding Test delta" })).toBeVisible();
    expect(sql("select profile_id is null and released_at is null from public.founding_member_numbers where number=1;")).toBe("t");
    await ceo.goto(`${origin}/founding-500`);
    await expect(ceo.getByText("Finalized: Founding numbers are permanent", { exact: false })).toBeVisible();
    await expect(ceo.getByText("Number permanently reserved", { exact: true })).toBeVisible();
    await ceo.screenshot({ path: testInfo.outputPath("finalized-public-registry.png"), fullPage: true });
  });
  await ceoContext.close();
  expect(pageErrors).toEqual([]);
});
