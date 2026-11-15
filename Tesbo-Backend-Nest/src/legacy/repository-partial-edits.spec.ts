import type { DatabaseService } from "../database/database.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const CASE = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const REVISION = "a".repeat(64);
const ROW = { id: CASE, project_id: PROJECT, title: "Existing case", attachments: "Human Notes", deleted_at: null };

function fixture(matched = true) {
  // SQL/collaborator contract double; migrated PostgreSQL tests own actual CAS
  // re-evaluation, trigger history and transaction rollback.
  const query = jest.fn(async (sql: string, _values?: unknown[]) => {
    if (sql.includes("pg_advisory_xact_lock")) return { rows: [] };
    if (sql.includes("UPDATE testcases SET")) return { rows: matched ? [{ ...ROW, title: "Edited" }] : [] };
    return { rows: [{ ...ROW, ...(sql.includes("AS edit_revision") ? { edit_revision: REVISION } : {}) }] };
  });
  const transaction = jest.fn(async <T>(work: (client: { query: typeof query }) => Promise<T>) => work({ query }));
  const svc = makeLegacy({ query, transaction } as unknown as DatabaseService);
  jest.spyOn(svc, "requireProjectAccess").mockResolvedValue({} as never);
  const activity = jest.spyOn(svc, "logProjectActivity").mockResolvedValue(undefined);
  const internals = svc as unknown as {
    customFields: { setValuesForTestCase: jest.Mock };
    customTags: { setTagsForTestCase: jest.Mock };
    suitesCache: { invalidate: jest.Mock };
    testcasesListCache: { invalidate: jest.Mock };
    enqueueTestcaseEmbedding: jest.Mock;
    notifyIssueLinked: jest.Mock;
  };
  const fields = internals.customFields.setValuesForTestCase = jest.fn().mockResolvedValue(undefined);
  const tags = internals.customTags.setTagsForTestCase = jest.fn().mockResolvedValue(undefined);
  const suites = jest.spyOn(internals.suitesCache, "invalidate").mockResolvedValue(undefined);
  const cases = jest.spyOn(internals.testcasesListCache, "invalidate").mockResolvedValue(undefined);
  const embedding = jest.spyOn(internals, "enqueueTestcaseEmbedding").mockReturnValue(undefined);
  const notice = jest.spyOn(internals, "notifyIssueLinked").mockResolvedValue(undefined);
  return { svc, query, transaction, effects: [fields, tags, activity, suites, cases, embedding, notice] };
}

describe("repository partial edits — optional row-revision precondition", () => {
  it("returns a revision computed in the same detail SELECT as the row, on REST and internal/MCP reads", async () => {
    const { svc, query } = fixture();
    expect(await svc.getTestCaseForUser(USER, PROJECT, CASE)).toMatchObject({ id: CASE, editRevision: REVISION });
    expect(await svc.getTestCase(CASE)).toMatchObject({ id: CASE, editRevision: REVISION });
    for (const [sql] of query.mock.calls) {
      expect(sql).toContain("sha256(convert_to((to_jsonb(testcases) - 'embedding_status' - 'embedding_content_hash' - 'updated_at')::text");
      expect(sql).toContain("AS edit_revision");
    }
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("checks the supplied revision on the actual UPDATE before custom fields, tags or postcommit effects", async () => {
    const f = fixture();
    await f.svc.updateTestCase(CASE, USER, { title: "Edited", expectedRevision: REVISION, customTagIds: [] });
    const [sql, values] = f.query.mock.calls.find(([sql]) => sql.includes("UPDATE testcases SET"))!;
    expect(sql).toContain("sha256(convert_to((to_jsonb(testcases) - 'embedding_status' - 'embedding_content_hash' - 'updated_at')::text");
    expect(sql).toContain("$37::text");
    expect(values?.[36]).toBe(REVISION);
    expect(values?.[24]).toBeNull(); // omitted Notes never get read/echoed back
    expect(f.effects[0]).toHaveBeenCalledTimes(1);
  });

  it("refuses a stale or concurrently deleted row without custom-field/tag/activity/cache/notification effects", async () => {
    const f = fixture(false);
    await expect(f.svc.updateTestCase(CASE, USER, {
      expectedRevision: REVISION, attachments: "Stale replacement",
      customFieldValues: { field: "must not write" }, customTagIds: []
    })).rejects.toMatchObject({ status: 409, response: { code: "TESTCASE_EDIT_CONFLICT" } });
    expect(f.transaction).toHaveBeenCalledTimes(1);
    for (const effect of f.effects) expect(effect).not.toHaveBeenCalled();
  });

  it.each([null, "", " ", "a".repeat(63), "a".repeat(65), "g".repeat(64), 1, true, [REVISION], { revision: REVISION }])
  ("refuses malformed expectedRevision %p without a database call", async (expectedRevision) => {
    const f = fixture();
    await expect(f.svc.updateTestCase(CASE, USER, { expectedRevision, title: "Invalid" }))
      .rejects.toMatchObject({ status: 400 });
    expect(f.query).not.toHaveBeenCalled();
    expect(f.transaction).not.toHaveBeenCalled();
    for (const effect of f.effects) expect(effect).not.toHaveBeenCalled();
  });

  it("keeps authentication refusal ahead of a malformed revision", async () => {
    const f = fixture();
    await expect(f.svc.updateTestCase(CASE, null, { expectedRevision: null }))
      .rejects.toMatchObject({ status: 400, response: { error: "Authentication required" } });
    expect(f.query).not.toHaveBeenCalled();
  });

  it("retains legacy omission and sends null for the optional guard", async () => {
    const f = fixture();
    await f.svc.updateTestCase(CASE, USER, { title: "Edited" });
    const [, values] = f.query.mock.calls.find(([sql]) => sql.includes("UPDATE testcases SET"))!;
    expect(values?.[36]).toBeNull();
    expect(f.effects[0]).toHaveBeenCalledTimes(1);
  });
});
