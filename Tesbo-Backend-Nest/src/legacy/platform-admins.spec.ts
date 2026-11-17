import { makeLegacy } from "./test-helpers/legacy-service.fixture";
import type { DatabaseService } from "../database/database.service";

/*
 * Managing platform admins is owner-only (docs/FEATURE_DOCUMENTATION.md's superadmin section);
 * requirePlatformAdmin is only the read/administration baseline. Before this, any platform admin
 * could grant another admin and remove the owner — and the ON CONFLICT update silently demoted the
 * install owner to plain admin.
 */

type Route = { match: string; rows?: Record<string, unknown>[] };

function makeDb(routes: Route[]) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = jest.fn((sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    for (const route of routes) {
      if (sql.includes(route.match)) return Promise.resolve({ rows: route.rows ?? [] });
    }
    return Promise.resolve({ rows: [] });
  });
  const transaction = jest.fn((fn: (client: { query: typeof query }) => Promise<unknown>) => fn({ query }));
  return { db: { query, transaction } as unknown as DatabaseService, query, calls };
}

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";

describe("platform admin management — owner-only", () => {
  it("refuses a plain platform admin adding or removing another admin", async () => {
    const { db, calls } = makeDb([{ match: "SELECT role FROM platform_admins WHERE user_id", rows: [{ role: "admin" }] }]);
    const svc = makeLegacy(db);
    await expect(svc.addAdmin("caller", { email: "other@example.com" })).rejects.toMatchObject({ status: 403 });
    await expect(svc.deleteAdmin("caller", ADMIN_ID)).rejects.toMatchObject({ status: 403 });
    expect(calls.some((call) => /INSERT INTO platform_admins|DELETE FROM platform_admins/.test(call.sql))).toBe(false);
  });

  it("lets an owner grant an admin without demoting an existing owner", async () => {
    const { db, calls } = makeDb([
      { match: "SELECT role FROM platform_admins WHERE user_id", rows: [{ role: "owner" }] },
      { match: "INSERT INTO users", rows: [{ id: "target-user" }] },
      { match: "INSERT INTO platform_admins", rows: [{ id: ADMIN_ID, user_id: "target-user", role: "admin" }] }
    ]);
    const svc = makeLegacy(db);
    await expect(svc.addAdmin("caller", { email: "Target@Example.com" })).resolves.toEqual({
      id: ADMIN_ID, userId: "target-user", role: "admin", email: "target@example.com"
    });
    const insert = calls.find((call) => call.sql.includes("INSERT INTO platform_admins"))!;
    expect(insert.sql).toContain("WHEN platform_admins.role = 'owner' THEN 'owner'");
  });

  it("lets an owner remove a plain admin but never an owner", async () => {
    const plain = makeDb([
      { match: "SELECT role FROM platform_admins WHERE user_id", rows: [{ role: "owner" }] },
      { match: "SELECT role FROM platform_admins WHERE id", rows: [{ role: "admin" }] }
    ]);
    await expect(makeLegacy(plain.db).deleteAdmin("caller", ADMIN_ID)).resolves.toBeUndefined();
    expect(plain.calls.some((call) => call.sql.includes("DELETE FROM platform_admins"))).toBe(true);

    const ownerTarget = makeDb([
      { match: "SELECT role FROM platform_admins WHERE user_id", rows: [{ role: "owner" }] },
      { match: "SELECT role FROM platform_admins WHERE id", rows: [{ role: "owner" }] }
    ]);
    await expect(makeLegacy(ownerTarget.db).deleteAdmin("caller", ADMIN_ID))
      .rejects.toMatchObject({ status: 403, response: { error: "A platform owner cannot be removed here" } });
    expect(ownerTarget.calls.some((call) => call.sql.includes("DELETE FROM platform_admins"))).toBe(false);
  });

  it("returns 404 for a malformed or missing admin id", async () => {
    const { db } = makeDb([{ match: "SELECT role FROM platform_admins WHERE user_id", rows: [{ role: "owner" }] }]);
    const svc = makeLegacy(db);
    await expect(svc.deleteAdmin("caller", "not-a-uuid")).rejects.toMatchObject({ status: 404 });
    await expect(svc.deleteAdmin("caller", ADMIN_ID)).rejects.toMatchObject({ status: 404 });
  });
});
