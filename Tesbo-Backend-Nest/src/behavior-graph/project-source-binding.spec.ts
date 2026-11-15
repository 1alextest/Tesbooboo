import { ConflictException } from "@nestjs/common";
import { ProjectSourceBindingReader } from "./project-source-binding";

const USER = "00000000-0000-4000-8000-000000000001";
const PROJECT = "00000000-0000-4000-8000-000000000002";
const ROW = { authorized: true, repository_id: "org/repo",
  checkout_key: "approved-source", ref_name: "development", selection_prefixes: ["src"] };

function make(row: Record<string, unknown>) {
  const query = jest.fn().mockResolvedValue({ rows: [row] });
  const db = { query } as never;
  const reader = new ProjectSourceBindingReader(db, {
    "approved-source": { repositoryId: "org/repo", root: "/trusted/source" }
  });
  return { reader, query };
}

describe("server-approved project source binding", () => {
  it("resolves an authorized binding without accepting a client-supplied checkout path", async () => {
    const { reader, query } = make(ROW);
    const value = await reader.resolveForUser(USER, PROJECT);
    expect(value.binding).toEqual({ projectId: PROJECT, repositoryId: "org/repo",
      checkoutKey: "approved-source", refName: "development", selectionPrefixes: ["src"] });
    expect(value.checkout.root).toBe("/trusted/source");
    expect(query).toHaveBeenCalledWith(expect.stringContaining("project_members"), [PROJECT, USER]);
    expect(query.mock.calls[0][0]).toContain("organization_members");
    expect(query.mock.calls[0][0]).toContain("b.enabled=true");
  });

  it("fails closed on missing membership, disabled binding or unknown checkout", async () => {
    await expect(make({ ...ROW, authorized: false }).reader.resolveForUser(USER, PROJECT))
      .rejects.toMatchObject({ status: 403 });
    await expect(make({ ...ROW, checkout_key: null }).reader.resolveForUser(USER, PROJECT))
      .rejects.toBeInstanceOf(ConflictException);
    await expect(make({ ...ROW, checkout_key: "other" }).reader.resolveForUser(USER, PROJECT))
      .rejects.toMatchObject({ status: 409 });
    await expect(make({ ...ROW, repository_id: "different/repository" }).reader.resolveForUser(USER, PROJECT))
      .rejects.toMatchObject({ status: 409 });
    await expect(make(ROW).reader.resolveForUser(null, PROJECT))
      .rejects.toMatchObject({ status: 403 });
  });

  it("does not return the filesystem checkout root as part of the project binding record", async () => {
    const { binding } = await make(ROW).reader.resolveForUser(USER, PROJECT);
    expect(JSON.stringify(binding)).not.toContain("/trusted/source");
    expect(binding).not.toHaveProperty("root");
  });
});
