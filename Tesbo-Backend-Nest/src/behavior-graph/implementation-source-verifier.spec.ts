import { createHash } from "node:crypto";
import { captureVerifiedSourceDeclarations, projectFromVerifiedSource, type PinnedSourceReader } from "./implementation-source-verifier";
import type { GraphCaptureForComparison } from "./graph-comparison-gate";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const revision = "a".repeat(40);
const file = "src/login.ts";
const bytes = Buffer.from("export const route = '/login';\nexport const state = 'ready';\n");
const firstLine = "export const route = '/login';";
const base: GraphCaptureForComparison = {
  snapshot: { projectId: "p1", revision: "native-v1", nodes: [], edges: [] },
  contractId: "native-v1", sourceScopeFingerprint: "native-scope",
  inventoryStatus: "complete", unresolvedDiagnostics: []
};
function reader(over: Partial<PinnedSourceReader> = {}): PinnedSourceReader {
  return {
    repositoryId: "org/product",
    resolveRef: jest.fn().mockResolvedValue(revision),
    listFilesAtCommit: jest.fn().mockResolvedValue([file]),
    readFileAtCommit: jest.fn().mockResolvedValue(bytes),
    ...over
  };
}
function request(over: Record<string, unknown> = {}) {
  return {
    projectId: "p1", refName: "development", expectedCommitSha: revision,
    proposedConcepts: [{ kind: "route" as const, key: "GET /login", filePath: file,
      lineStart: 1, lineEnd: 1, declarationSha256: sha(firstLine) }],
    ...over
  };
}

describe("pinned source evidence validation before graph projection", () => {
  it("rehashes actual source bytes and binds a declaration to the pinned commit lines", async () => {
    const r = reader();
    const observation = await captureVerifiedSourceDeclarations(r, request());
    expect(observation.files).toEqual([{ path: file, contentSha256: sha(bytes.toString("utf8")) }]);
    expect(observation.commitSha).toBe(revision);
    expect(r.readFileAtCommit).toHaveBeenCalledWith(revision, file);
    const graph = await projectFromVerifiedSource(base, r, request());
    expect(graph.snapshot?.nodes.map((n) => n.type)).toEqual([
      "implementation_file", "source_declared_route"
    ]);
    expect(graph.coverageAssertion).toBe("none");
    expect(graph.executionAssertion).toBe("none");
  });

  it("refuses ref movement rather than projecting stale or substituted source", async () => {
    const r = reader({ resolveRef: jest.fn().mockResolvedValue("b".repeat(40)) });
    await expect(captureVerifiedSourceDeclarations(r, request())).rejects.toThrow("ref moved");
    expect(r.readFileAtCommit).not.toHaveBeenCalled();
  });

  it("rejects a tampered source declaration hash, including an otherwise valid path", async () => {
    await expect(captureVerifiedSourceDeclarations(reader(), request({
      proposedConcepts: [{ ...request().proposedConcepts[0], declarationSha256: "f".repeat(64) }]
    }))).rejects.toThrow("declaration bytes do not match");
  });

  it("refuses nonexistent lines rather than treating the declaration as verified", async () => {
    await expect(captureVerifiedSourceDeclarations(reader(), request({
      proposedConcepts: [{ ...request().proposedConcepts[0], lineStart: 5, lineEnd: 7 }]
    }))).rejects.toThrow("missing source lines");
  });

  it("rejects cross-project projection and does not grant Graph authority from the reader", async () => {
    await expect(projectFromVerifiedSource(base, reader(), request({ projectId: "another" })))
      .rejects.toThrow("project mismatch");
  });

  it("rejects duplicated and traversal source tree entries before reading blobs", async () => {
    for (const paths of [[file, file], ["../private.ts"], ["/root/file.ts"]]) {
      const r = reader({ listFilesAtCommit: jest.fn().mockResolvedValue(paths) });
      await expect(captureVerifiedSourceDeclarations(r, request())).rejects.toThrow("source tree path");
      expect(r.readFileAtCommit).not.toHaveBeenCalled();
    }
  });

  it("rejects incomplete source/blob inventory instead of claiming comprehensive observations", async () => {
    await expect(captureVerifiedSourceDeclarations(reader({
      listFilesAtCommit: jest.fn().mockResolvedValue(Array.from({ length: 2001 }, (_, i) => `src/f${i}.ts`))
    }), request())).rejects.toThrow("exceeds limit");
    await expect(captureVerifiedSourceDeclarations(reader({
      readFileAtCommit: jest.fn().mockResolvedValue(Buffer.alloc(2 * 1024 * 1024 + 1))
    }), request())).rejects.toThrow("bounded source blob");
  });

  it("rejects malformed and duplicate proposed concepts", async () => {
    const original = request().proposedConcepts[0];
    await expect(captureVerifiedSourceDeclarations(reader(), request({
      proposedConcepts: [original, original]
    }))).rejects.toThrow("duplicate declaration");
    await expect(captureVerifiedSourceDeclarations(reader(), request({
      proposedConcepts: [{ ...original, declarationSha256: "invalid" }]
    }))).rejects.toThrow("malformed proposed");
  });
});
