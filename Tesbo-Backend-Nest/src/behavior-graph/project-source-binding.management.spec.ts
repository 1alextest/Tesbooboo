import { ProjectSourceBindingManagement } from "./project-source-binding.management";

const USER = "00000000-0000-4000-8000-000000000001";
const PROJECT = "00000000-0000-4000-8000-000000000002";
const CONFIG = {
  repositoryId: "org/repo", checkoutKey: "trusted", refName: "development",
  selectionPrefixes: ["src", "tests"], enabled: true
};

function fixture(options: { owner?: boolean; binding?: boolean; saved?: boolean; approved?: boolean } = {}) {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes("SELECT EXISTS(")) return { rows: [{ allowed: options.owner !== false }] };
    if (sql.includes("SELECT b.repository_id")) return {
      rows: options.binding === false ? [] : [{
        repository_id: CONFIG.repositoryId, checkout_key: CONFIG.checkoutKey,
        ref_name: CONFIG.refName, selection_prefixes: CONFIG.selectionPrefixes, enabled: CONFIG.enabled
      }]
    };
    if (sql.includes("INSERT INTO project_source_bindings")) return {
      rows: options.saved === false ? [] : [{ project_id: PROJECT }]
    };
    throw new Error("unexpected SQL query");
  });
  const isApprovedCheckout = jest.fn().mockReturnValue(options.approved !== false);
  const svc = new ProjectSourceBindingManagement({ query } as never, { isApprovedCheckout } as never);
  return { svc, query, isApprovedCheckout };
}

describe("owner-only source provisioning and root-free binding contract", () => {
  it("reads an authorized binding but never exposes an approved checkout root", async () => {
    const { svc, query } = fixture();
    expect(await svc.getForOwner(USER, PROJECT)).toEqual({ configured: true, binding: CONFIG });
    expect(query.mock.calls[0][0]).toContain("pm.role='owner'");
    expect(query.mock.calls[1][0]).toContain("organization_members");
    expect(JSON.stringify(await svc.getForOwner(USER, PROJECT))).not.toContain("/srv");
  });

  it("returns unconfigured without inventing an approved checkout", async () => {
    expect(await fixture({ binding: false }).svc.getForOwner(USER, PROJECT))
      .toEqual({ configured: false, binding: null });
  });

  it("writes only the approved identity, ref and selection through atomic owner authorization", async () => {
    const { svc, query, isApprovedCheckout } = fixture();
    expect(await svc.setForOwner(USER, PROJECT, CONFIG)).toEqual({ configured: true, binding: CONFIG });
    expect(isApprovedCheckout).toHaveBeenCalledWith("trusted", "org/repo");
    const [sql, values] = query.mock.calls[1];
    expect(sql).toContain("FOR SHARE OF p, pm, om");
    expect(sql).toContain("pm.role='owner'");
    expect(sql).toContain("ON CONFLICT (project_id) DO UPDATE");
    expect(sql).toContain("RETURNING project_id::text");
    expect(values).toEqual([PROJECT, USER, "org/repo", "trusted", "development", ["src", "tests"], true]);
    expect(sql).not.toContain("filesystem");
  });

  it.each([
    null, [], {}, { ...CONFIG, root: "/tmp/forged" },
    { ...CONFIG, credentials: "secret" },
    { ...CONFIG, checkoutKey: "untrusted" },
    { ...CONFIG, refName: "../escape" },
    { ...CONFIG, refName: "/absolute" },
    { ...CONFIG, selectionPrefixes: ["../etc"] },
    { ...CONFIG, selectionPrefixes: ["/tmp"] },
    { ...CONFIG, selectionPrefixes: ["src", "src"] },
    { ...CONFIG, selectionPrefixes: new Array(33).fill("src") },
    { ...CONFIG, selectionPrefixes: "src" },
    { ...CONFIG, enabled: "true" },
    { ...CONFIG, repositoryId: "not-qualified" }
  ])("refuses malformed, injected or ambiguous binding %p without a write", async (payload) => {
    const { svc, query } = fixture({ approved: !!(payload as Record<string, unknown> | null)?.checkoutKey &&
      (payload as Record<string, unknown>).checkoutKey === "trusted" });
    await expect(svc.setForOwner(USER, PROJECT, payload)).rejects.toMatchObject({ status: 400 });
    expect(query.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO project_source_bindings"))).toHaveLength(0);
  });

  it("rejects an unknown approved checkout and does not persist it", async () => {
    const { svc, query } = fixture({ approved: false });
    await expect(svc.setForOwner(USER, PROJECT, CONFIG)).rejects.toMatchObject({ status: 400 });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("refuses nonowners and does not reveal project state or write", async () => {
    const { svc, query } = fixture({ owner: false });
    await expect(svc.getForOwner(USER, PROJECT)).rejects.toMatchObject({ status: 403 });
    await expect(svc.setForOwner(USER, PROJECT, CONFIG)).rejects.toMatchObject({ status: 403 });
    await expect(svc.setForOwner(null, PROJECT, CONFIG)).rejects.toMatchObject({ status: 403 });
    expect(query.mock.calls.some(([sql]) => String(sql).includes("project_source_bindings"))).toBe(false);
  });

  it("refuses persistence if ownership is revoked between preliminary check and INSERT", async () => {
    const { svc } = fixture({ saved: false });
    await expect(svc.setForOwner(USER, PROJECT, CONFIG)).rejects.toMatchObject({ status: 403 });
  });

  it("supports disabled binding without erasing its approved provenance", async () => {
    const { svc } = fixture();
    expect(await svc.setForOwner(USER, PROJECT, { ...CONFIG, enabled: false }))
      .toMatchObject({ configured: true, binding: { enabled: false } });
  });
});
