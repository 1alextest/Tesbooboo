import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { StorageService } from "./storage.service";

/*
 * exists() deliberately answers true for S3 without contacting the bucket ("checked lazily via
 * the signed URL request itself"). verify() is the honest counterpart used where the product
 * claims bytes were checked: it stats locally, HEADs S3, and compares the metadata row's
 * recorded size so a truncated object is not reported as intact.
 */

function localConfig(uploadDir: string): Record<string, unknown> {
  return {
    storageDriver: "local",
    uploadDir,
    s3Bucket: "",
    s3BucketFolder: "",
    s3Region: "",
    s3Endpoint: undefined,
    s3ForcePathStyle: false,
    s3AccessKeyId: "",
    s3SecretAccessKey: ""
  };
}

function s3Service(): { service: StorageService; send: jest.Mock } {
  const service = new StorageService({
    ...localConfig("/unused"),
    storageDriver: "s3",
    s3Bucket: "evidence-bucket",
    s3BucketFolder: "staging",
    s3Region: "us-east-1"
  } as never);
  const send = jest.fn();
  (service as unknown as { s3: { send: jest.Mock } }).s3 = { send };
  return { service, send };
}

describe("StorageService.verify", () => {
  let dir = "";

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "tesbo-storage-verify-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("reports a local object's real size and flags a metadata mismatch", async () => {
    const service = new StorageService(localConfig(dir) as never);
    fs.mkdirSync(path.join(dir, "evidence"), { recursive: true });
    fs.writeFileSync(path.join(dir, "evidence", "object.txt"), "1234567890");

    await expect(service.verify("evidence/object.txt", 10)).resolves.toEqual({
      available: true,
      bytes: 10,
      byteMismatch: false
    });
    await expect(service.verify("evidence/object.txt", 11)).resolves.toMatchObject({
      available: true,
      bytes: 10,
      byteMismatch: true
    });
  });

  it("reports a missing local object instead of throwing", async () => {
    const service = new StorageService(localConfig(dir) as never);
    await expect(service.verify("evidence/missing.txt", null)).resolves.toEqual({
      available: false,
      bytes: null,
      byteMismatch: false
    });
  });

  it("HEADs the prefixed S3 key and uses ContentLength", async () => {
    const { service, send } = s3Service();
    send.mockResolvedValueOnce({ ContentLength: 42 });

    await expect(service.verify("evidence/object.txt", 42)).resolves.toEqual({
      available: true,
      bytes: 42,
      byteMismatch: false
    });
    const command = send.mock.calls[0][0] as { constructor: { name: string }; input: Record<string, unknown> };
    expect(command.constructor.name).toBe("HeadObjectCommand");
    expect(command.input).toMatchObject({ Bucket: "evidence-bucket", Key: "staging/evidence/object.txt" });
  });

  it("reports an S3 object the HEAD cannot find as unavailable", async () => {
    const { service, send } = s3Service();
    send.mockRejectedValueOnce(Object.assign(new Error("NotFound"), { name: "NotFound" }));
    await expect(service.verify("evidence/missing.txt", null)).resolves.toEqual({
      available: false,
      bytes: null,
      byteMismatch: false
    });
  });

  it("compares an S3 ContentLength against the recorded size", async () => {
    const { service, send } = s3Service();
    send.mockResolvedValueOnce({ ContentLength: 7 });
    await expect(service.verify("evidence/object.txt", 12)).resolves.toMatchObject({
      available: true,
      bytes: 7,
      byteMismatch: true
    });
  });
});

describe("StorageService local path confinement", () => {
  let dir = "";
  let outside = "";

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "tesbo-storage-root-"));
    outside = fs.mkdtempSync(path.join(os.tmpdir(), "tesbo-storage-outside-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });

  it("refuses a key that resolves outside the upload directory", async () => {
    // Keys are generated server-side today, but this is the boundary that turns one into a
    // filesystem path for every read, write and delete. A mistake there must fail loudly rather
    // than read, overwrite or unlink a file next to the upload directory.
    const service = new StorageService(localConfig(dir) as never);
    const escape = path.relative(dir, path.join(outside, "stolen.txt"));

    await expect(service.put(escape, Buffer.from("x"), "text/plain")).rejects.toThrow(/escapes the upload directory/);
    expect(fs.existsSync(path.join(outside, "stolen.txt"))).toBe(false);
    await expect(service.getBuffer("../outside.txt")).rejects.toThrow(/escapes the upload directory/);
    await expect(service.delete(escape)).rejects.toThrow(/escapes the upload directory/);
  });

  it("still reads and writes a normal nested key", async () => {
    const service = new StorageService(localConfig(dir) as never);
    await service.put("executions/project/run/file.txt", Buffer.from("ok"), "text/plain");
    await expect(service.getBuffer("executions/project/run/file.txt")).resolves.toEqual(Buffer.from("ok"));
  });
});
