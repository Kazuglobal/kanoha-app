import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/0005_slack_vault.sql", "utf8");

describe("Slack Vault migration", () => {
  it("reserves decrypted webhook delivery access for service_role", () => {
    expect(migration).toContain(
      "grant execute on function public.get_slack_delivery_settings(uuid) to service_role;",
    );
    expect(migration).not.toContain(
      "grant execute on function public.get_slack_delivery_settings(uuid) to authenticated;",
    );
  });
});
