import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { DatabaseService } from "../database/database.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";

const PROJECT = "10000000-0000-4000-8000-000000000001";
const DOCUMENT = "20000000-0000-4000-8000-000000000002";
const USER = "30000000-0000-4000-8000-000000000003";

// These boundary regressions use synthetic SQL responses. Exact snapshot persistence,
// transaction atomicity and concurrency are covered by knowledge-document-writes.db.spec.ts.
describe("AI memory review authority", () => {
  function fixture() {
    const doc = { id: DOCUMENT, project_id: PROJECT, document_type: "ai_memory", status: "draft", title: "Candidate", edit_revision: "a".repeat(64) };
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("project_members")) return { rows: [{ role: "owner" }] };
      return { rows: [doc] };
    });
    const svc = makeLegacy({ query } as unknown as DatabaseService);
    jest.spyOn(svc, "requireProjectAccess").mockResolvedValue({ id: PROJECT } as never);
    jest.spyOn(svc, "logProjectActivity").mockResolvedValue(undefined);
    const review = svc.approveAiMemory.bind(svc) as (...args: unknown[]) => Promise<unknown>;
    return { query, review };
  }

  it("refuses an administrator-owned API token before any document update", async () => {
    const { query, review } = fixture();
    await expect(review(PROJECT, USER, DOCUMENT, { expectedRevision: "a".repeat(64) }, { kind: "api_token" })).rejects.toBeInstanceOf(ForbiddenException);
    expect(query.mock.calls.some(([sql]) => /UPDATE|INSERT/.test(sql))).toBe(false);
  });

  it("does not infer an interactive human principal from the presence of a user id", async () => {
    const { query, review } = fixture();
    await expect(review(PROJECT, USER, DOCUMENT, { expectedRevision: "a".repeat(64) })).rejects.toBeInstanceOf(ForbiddenException);
    expect(query.mock.calls.some(([sql]) => /UPDATE|INSERT/.test(sql))).toBe(false);
  });

  it("requires the exact revision that the human reviewed", async () => {
    const { query, review } = fixture();
    await expect(review(PROJECT, USER, DOCUMENT, {}, { kind: "human_session" })).rejects.toBeInstanceOf(BadRequestException);
    expect(query.mock.calls.some(([sql]) => /UPDATE|INSERT/.test(sql))).toBe(false);
  });
});
