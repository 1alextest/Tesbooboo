import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import type { Client } from "pg";

export const REPORTER_CALLBACKS_READY = "[ci-reporter-startup] delivered all 3 result callbacks";

/** Gate only this disposable project's run INSERT until the child delivers its real test results. */
export async function withReporterStartupGate<T>(db: Client, projectId: string, runName: string, run: (release: () => Promise<void>) => Promise<T>): Promise<T> {
  const url = new URL(process.env.DATABASE_URL!);
  expect(["127.0.0.1", "localhost"]).toContain(url.hostname); expect(url.pathname).toBe("/tesbo_ci");
  expect(projectId).toMatch(/^[a-f0-9-]{36}$/i);
  const name = `ci_reporter_start_${randomUUID().replace(/-/g, "")}`, lock = `${name}:${projectId}`;
  let released: Promise<void> | undefined;
  const release = () => released ??= db.query("SELECT pg_advisory_unlock(hashtext($1))", [lock]).then(() => undefined);
  try {
    await db.query("SELECT pg_advisory_lock(hashtext($1))", [lock]);
    await db.query(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      PERFORM pg_advisory_xact_lock(hashtext('${lock}')); RETURN NEW; END $$`);
    await db.query(`CREATE TRIGGER ${name} BEFORE INSERT ON cycles FOR EACH ROW
      WHEN (NEW.project_id='${projectId}'::uuid AND NEW.source='automation' AND NEW.name='${runName.replace(/'/g, "''")}')
      EXECUTE FUNCTION ${name}()`);
    return await run(release);
  } finally {
    try { await release(); }
    finally {
      try { await db.query(`DROP TRIGGER IF EXISTS ${name} ON cycles`); }
      finally { await db.query(`DROP FUNCTION IF EXISTS ${name}()`); }
    }
  }
}
