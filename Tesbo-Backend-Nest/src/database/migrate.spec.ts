import fs = require("fs");
import * as path from "path";
import * as vm from "vm";
import * as ts from "typescript";
import type { PoolClient } from "pg";
import {
  applyMigration, configuredDatabaseUrl, main, normalizeDatabaseUrl, parseMigrationFilename,
  pendingMigrations, validateAppliedChecksums, type MigrationFile
} from "./migrate";
import { Pool } from "pg";

jest.mock("pg", () => ({ Pool: jest.fn(() => { throw new Error("Unexpected pool construction"); }) }));
jest.mock("dotenv", () => ({ config: jest.fn() }));

describe("migration CLI import safety", () => {
  async function observeEntrypoint(directCli: boolean, env: NodeJS.ProcessEnv = {}, dotenvUrl?: string) {
    const effects: string[] = [];
    const pools: unknown[] = [];
    let finish!: () => void;
    const exited = new Promise<void>(resolve => { finish = resolve; });
    const effect = (name: string, value?: unknown) => () => { effects.push(name); return value; };
    const imports: Record<string, unknown> = {
      crypto: {},
      dotenv: { config: () => { effects.push("dotenv"); if (dotenvUrl) env.DATABASE_URL = dotenvUrl; } },
      fs: {
        existsSync: (filename: string) => { effects.push("filesystem"); return !filename.endsWith(".env"); },
        readdirSync: effect("migration listing", [])
      },
      path,
      pg: { Pool: function(options: unknown) {
        effects.push("pool");
        pools.push(options);
        return { connect: async () => { effects.push("connect"); throw new Error("Synthetic connection refusal"); } };
      } }
    };
    const entryModule = {};
    const load = Object.assign((name: string) => {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    }, { main: directCli ? entryModule : {} });
    const source = fs.readFileSync(path.join(__dirname, "migrate.ts"), "utf8");
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    vm.runInNewContext(output.outputText, {
      require: load, module: entryModule, exports: {}, URL,
      process: { env, cwd: () => "/unused", exit: () => { effects.push("exit"); finish(); } },
      console: { error: effect("error"), log: effect("log"), warn: effect("warn") }
    });
    // The unfixed async main() rejection also gets observed without a real exit.
    await Promise.resolve();
    await Promise.resolve();
    if (directCli) await exited;
    return { effects, pools };
  }

  it("importing performs no environment, filesystem, database or process-exit work", async () => {
    expect((await observeEntrypoint(false)).effects).toEqual([]);
  });

  it("direct CLI still starts, but missing configuration exits before migration reads or pool construction", async () => {
    expect((await observeEntrypoint(true)).effects).toEqual(["filesystem", "dotenv", "error", "exit"]);
  });

  it.each([false, true])("configured direct CLI reaches only the fake Pool, including dotenv-supplied URL (%p)", async fromDotenv => {
    const raw = " jdbc:postgresql://fixture.invalid:5432/not_a_real_database ";
    const env = { DATABASE_USER: "fixture-user", DATABASE_PASSWORD: "synthetic-password",
      ...(fromDotenv ? {} : { DATABASE_URL: raw }) };
    const observed = await observeEntrypoint(true, env, fromDotenv ? raw : undefined);
    expect(observed.pools).toEqual([{
      connectionString: raw.trim().slice("jdbc:".length),
      user: "fixture-user", password: "synthetic-password", max: 1
    }]);
    expect(observed.effects).toEqual(["filesystem", "dotenv", "filesystem", "migration listing", "pool", "connect", "error", "exit"]);
  });
});

const migration = (version: number, name = `migration_${version}`, checksum = `synthetic-${version}`): MigrationFile => ({
  version, name, filename: `V${version}_${name}.sql`, checksum, path: `/unused/V${version}.sql`
});
const clientWith = (rows: unknown[]) => ({ query: jest.fn().mockResolvedValue({ rows }) });
const asClient = (value: { query: jest.Mock }) => value as unknown as PoolClient;

describe("migration decisions without a database", () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([undefined, "", " ", "\n\t"])("refuses missing/blank configuration (%p) without constructing a pool", async raw => {
    const previous = process.env.DATABASE_URL;
    if (raw === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = raw;
    try {
      expect(() => configuredDatabaseUrl()).toThrow("DATABASE_URL is required");
      await expect(main()).rejects.toThrow("DATABASE_URL is required");
      expect(Pool).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });

  it("retains explicit URLs and JDBC normalization, without connecting", () => {
    for (const url of ["postgresql://ci:5432/tesbo_ci", "postgres://ci:5432/rb_test_ci"]) {
      expect(normalizeDatabaseUrl(` jdbc:${url} `)).toBe(url);
      expect(configuredDatabaseUrl({ DATABASE_URL: ` ${url} ` })).toBe(url);
    }
  });

  it.each(["postgresql://", "postgres://", "not-a-postgres-url", "mysql://fixture.invalid/db",
    "postgresql://fixture.invalid", "postgresql://fixture.invalid/"])("refuses malformed/incomplete explicit configuration (%p) without a pool", async raw => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = raw;
    try {
      expect(() => configuredDatabaseUrl()).toThrow("must explicitly specify");
      await expect(main()).rejects.toThrow("must explicitly specify");
      expect(Pool).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });

  it("parses existing numbered names and rejects other filenames", () => {
    expect(parseMigrationFilename("V76_password_reset_tokens.sql")).toEqual({ version: 76, name: "password_reset_tokens" });
    expect(parseMigrationFilename("notes.sql")).toBeNull();
  });

  it("accepts exact checksums and rejects an unrecognized version/file/checksum mismatch", async () => {
    const files = [migration(1)];
    await expect(validateAppliedChecksums(asClient(clientWith([files[0]])), files)).resolves.toBeUndefined();
    const client = clientWith([{ version: 1, filename: "V1_unrecognized.sql", checksum: "synthetic-mismatch" }]);
    await expect(validateAppliedChecksums(asClient(client), files)).rejects.toThrow("Checksum mismatch");
  });

  it("preserves the source-backed V76 admin-plan -> V77 checksum alias without reapplying non-idempotent SQL", async () => {
    // Synthetic hashes describe identity, NOT asserted historical deployed SHA-256.
    const password = migration(76, "password_reset_tokens");
    const admin = migration(77, "admin_plan_override", "synthetic-original-admin-bytes");
    const applied = [{ version: 76, filename: "V76_admin_plan_override.sql", checksum: admin.checksum }];
    const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(validateAppliedChecksums(asClient(clientWith(applied)), [password, admin])).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("version fork at 76"));
    expect(pendingMigrations([password, admin], applied)).toEqual([]);
  });

  it("preserves documented old-V78 same-filename compatibility; this is NOT a general drift-protection assertion", async () => {
    // Git history 36673f6f intentionally changed V78 in place. No deployed tuple
    // is invented here; broad filename acceptance is unchanged policy debt.
    const files = [migration(78, "cycle_items_unique_testcase", "synthetic-new-v78")];
    const applied = [{ ...files[0], checksum: "synthetic-old-v78" }];
    const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(validateAppliedChecksums(asClient(clientWith(applied)), files)).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("version fork at 78"));
    const convergence = [migration(79, "cycle_items_unique_testcase"), migration(80, "password_reset_tokens")];
    expect(pendingMigrations([...files, ...convergence], applied)).toEqual(convergence);
  });

  it("retains the existing unknown-version warning without presenting it as approved history", async () => {
    const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(validateAppliedChecksums(asClient(clientWith([migration(999)])), [migration(1)])).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("unknown applied migration version 999"));
  });

  it("keeps unrelated pending migrations while independently respecting version, filename and checksum identity", () => {
    const files = [migration(1), migration(2), migration(3), migration(4)];
    const applied = [
      { version: 1, filename: "old-first.sql", checksum: "old-first" },
      { version: 8, filename: files[1].filename, checksum: "old-second" },
      { version: 9, filename: "old-third.sql", checksum: files[2].checksum }
    ];
    expect(pendingMigrations(files, [])).toEqual(files);
    expect(pendingMigrations([], applied)).toEqual([]);
    expect(pendingMigrations(files, files)).toEqual([]);
    expect(pendingMigrations(files, applied)).toEqual([files[3]]);
  });

  it.each(["success", "sql failure", "ledger failure"])("preserves transaction query ordering: %s (mock orchestration only)", async outcome => {
    jest.spyOn(fs, "readFileSync").mockReturnValue("SELECT 'synthetic fixture';");
    const client = clientWith([]);
    if (outcome !== "success") client.query.mockImplementation(async (sql: string) => {
      if (outcome === "sql failure" && sql.startsWith("SELECT")) throw new Error(outcome);
      if (outcome === "ledger failure" && sql.includes("INSERT INTO")) throw new Error(outcome);
      return { rows: [] };
    });
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const action = applyMigration(asClient(client), migration(1));
    if (outcome === "success") await expect(action).resolves.toBeUndefined();
    else await expect(action).rejects.toThrow(outcome);
    const queries = client.query.mock.calls.map(call => call[0] as string);
    expect(queries).toEqual([
      "BEGIN", "SELECT 'synthetic fixture';",
      ...(outcome === "sql failure" ? [] : [expect.stringContaining("INSERT INTO schema_migrations")]),
      outcome === "success" ? "COMMIT" : "ROLLBACK"
    ]);
    if (outcome !== "sql failure") expect(client.query.mock.calls[2][1]).toEqual([
      1, "migration_1", "V1_migration_1.sql", "synthetic-1", expect.any(Number)
    ]);
    expect(log).toHaveBeenCalledTimes(outcome === "success" ? 1 : 0);
    if (outcome !== "success") expect(queries).not.toContain("COMMIT");
  });
});
