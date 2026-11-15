import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client, Pool } from "pg";
import { DatabaseService } from "../database/database.service";
import { makeLegacy } from "../legacy/test-helpers/legacy-service.fixture";
import { CurrentCacheGraphReader } from "./current-cache-graph.reader";
import { CurrentCacheGraphHistory } from "./current-cache-graph.history";
import { GraphChangeReviewDelivery } from "./graph-change-review.delivery";
import { GraphChangeReviewRecovery } from "./graph-change-review.recovery";
import { writeNotifications } from "../legacy/notification-writer";
import { ProjectSourceBindingReader } from "./project-source-binding";
import { ProjectSourceBindingManagement } from "./project-source-binding.management";
import { ProjectSourceGraphCoordinator } from "./project-source-graph.coordinator";

const url = process.env.DATABASE_URL ?? "";
(/\/tesbo_ci(?:\?|$)/.test(url) ? describe : describe.skip)(
  "current cache graph history — real migrated PostgreSQL", () => {
    let admin: Client, pool: Pool, store: CurrentCacheGraphHistory;
    let org: string, project: string, user: string, caseId: string;
    const stamp = randomUUID();

    beforeAll(async () => {
      admin = new Client({ connectionString: url });
      await admin.connect();
      pool = new Pool({ connectionString: url, max: 5 });
      user = (await admin.query("INSERT INTO users(email,name) VALUES ($1,'Graph history QA') RETURNING id",
        [`history-${stamp}@tesbo.invalid`])).rows[0].id;
      org = (await admin.query("INSERT INTO organizations(name,slug) VALUES ('Graph history QA',$1) RETURNING id",
        [`history-${stamp}`])).rows[0].id;
      await admin.query("UPDATE users SET active_organization_id=$2 WHERE id=$1", [user, org]);
      project = (await admin.query("INSERT INTO projects(organization_id,key,name) VALUES ($1,'GHIS','Graph history') RETURNING id", [org])).rows[0].id;
      await admin.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'member')", [org,user]);
      await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'qa_engineer')", [project,user]);
      caseId = (await admin.query("INSERT INTO testcases(project_id,external_id,title) VALUES ($1,'GHIS-TC-1','Original') RETURNING id", [project])).rows[0].id;
      const db = new DatabaseService(pool);
      store = new CurrentCacheGraphHistory(db, new CurrentCacheGraphReader(db, makeLegacy(db)));
    });

    afterAll(async () => {
      await pool?.end();
      await admin?.end();
    });

    it("writes an authorized initial observation, not a fictitious changed-requirement notice", async () => {
      const result = await store.captureForUser(user, project);
      expect(result.stored).toBe(true);
      expect(result.reviewReceipt).toBeNull();
      const row = await admin.query("SELECT capture_json, review_receipt_json FROM graph_capture_history WHERE id=$1", [result.id]);
      expect(row.rows[0].capture_json.snapshot.nodes).toHaveLength(1);
      expect(row.rows[0].capture_json.upstreamFreshness).toBe("unverified");
      expect(row.rows[0].review_receipt_json).toBeNull();
    });

    it("is idempotent on an unchanged project snapshot and serializes concurrent retries", async () => {
      const [a,b] = await Promise.all([store.captureForUser(user,project),store.captureForUser(user,project)]);
      expect(a.id).toBe(b.id);
      expect(a.stored).toBe(false);
      expect(b.stored).toBe(false);
      const rows = await admin.query("SELECT COUNT(*)::int AS count FROM graph_capture_history WHERE project_id=$1", [project]);
      expect(rows.rows[0].count).toBe(1);
    });

    it("appends an exact versioned case change receipt and retains both historical captures", async () => {
      await admin.query("UPDATE testcases SET title='Changed' WHERE id=$1", [caseId]);
      const result = await store.captureForUser(user, project);
      expect(result.stored).toBe(true);
      expect(result.reviewReceipt?.candidates[0].reasons).toContain("case_changed");
      expect(result.reviewReceipt?.evidence.executionAssertion).toBe("none");
      const saved = await admin.query("SELECT review_receipt_json FROM graph_capture_history WHERE id=$1", [result.id]);
      expect(saved.rows[0].review_receipt_json.id).toBe(result.reviewReceipt?.id);
      expect((await admin.query("SELECT COUNT(*)::int AS count FROM graph_capture_history WHERE project_id=$1", [project])).rows[0].count).toBe(2);
    });

    it("refuses missing authorization and does not write another history row", async () => {
      await expect(store.captureForUser(randomUUID(), project)).rejects.toBeDefined();
      await expect(store.captureForUser(null, project)).rejects.toBeDefined();
      expect((await admin.query("SELECT COUNT(*)::int AS count FROM graph_capture_history WHERE project_id=$1", [project])).rows[0].count).toBe(2);
    });

    it("lists history with current membership, stable newest-first pagination and no raw snapshot exposure", async () => {
      const full = await store.listForUser(user, project);
      expect(full).toHaveLength(2);
      expect(BigInt(full[0].id)).toBeGreaterThan(BigInt(full[1].id));
      expect(full[0].reviewReceipt?.evidence.coverageAssertion).toBe("none");
      expect(full.map((item) => item.changeState)).toEqual(["changed", "baseline"]);
      expect(full[0]).not.toHaveProperty("capture_json");
      expect(full[0]).not.toHaveProperty("captureJson");
      const page = await store.listForUser(user, project, 1);
      const older = await store.listForUser(user, project, 1, page[0].id);
      expect(page.map((e) => e.id)).toEqual([full[0].id]);
      expect(older.map((e) => e.id)).toEqual([full[1].id]);
      expect(await store.listForUser(user, project, 1, full[1].id)).toEqual([]);
    });

    it("refuses cross-project history reads and invalid pagination without exposing records", async () => {
      await expect(store.listForUser(randomUUID(), project)).rejects.toMatchObject({ status: 403 });
      await expect(store.listForUser(null, project)).rejects.toMatchObject({ status: 403 });
      await expect(store.listForUser(user, project, 0)).rejects.toMatchObject({ status: 409 });
      await expect(store.listForUser(user, project, 101)).rejects.toMatchObject({ status: 409 });
      await expect(store.listForUser(user, project, 1, "0 OR TRUE")).rejects.toMatchObject({ status: 409 });
      await expect(store.listForUser(user, project, 1, "99999999999999999999")).rejects.toMatchObject({ status: 409 });
      const foreign = (await admin.query(
        "INSERT INTO projects(organization_id,key,name) VALUES ($1,'GHIF','Foreign graph') RETURNING id",
        [org]
      )).rows[0].id;
      await expect(store.listForUser(user, foreign)).rejects.toMatchObject({ status: 403 });
    });

    it("refuses incomplete local source cache rather than persisting false completeness", async () => {
      await admin.query("UPDATE testcases SET jira_issue_key='UNSYNCED-1' WHERE id=$1", [caseId]);
      try {
        await expect(store.captureForUser(user, project)).rejects.toMatchObject({
          status: 409,
          response: { error: "Graph capture not comparable: cached source inventory incomplete or ambiguous" }
        });
        expect((await admin.query("SELECT COUNT(*)::int AS count FROM graph_capture_history WHERE project_id=$1", [project])).rows[0].count).toBe(2);
      } finally {
        await admin.query("UPDATE testcases SET jira_issue_key=NULL WHERE id=$1", [caseId]);
      }
    });
    it("marks a provider mapping or contract discontinuity as unknown, including across pages", async () => {
      // Disposable DB fixture: simulate a distinct, committed source-scope
      // observation without manufacturing any requirement-to-case coverage.
      const inserted = await admin.query(
        `INSERT INTO graph_capture_history
           (project_id, captured_by_user_id, contract_id, source_scope_fingerprint,
            revision, capture_json, review_receipt_json)
         SELECT project_id, captured_by_user_id, contract_id, 'different-provider-scope',
                'discontinuity-fixture', capture_json, NULL
           FROM graph_capture_history WHERE project_id=$1
           ORDER BY id DESC LIMIT 1 RETURNING id::text`,
        [project]
      );
      expect(inserted.rows).toHaveLength(1);
      const newest = await store.listForUser(user, project, 1);
      expect(newest[0].id).toBe(inserted.rows[0].id);
      expect(newest[0].reviewReceipt).toBeNull();
      expect(newest[0].changeState).toBe("source_scope_changed");
      const older = await store.listForUser(user, project, 1, newest[0].id);
      expect(older[0].changeState).toBe("changed");
    });

    it("uses the approved project Git binding to persist real source bytes in the existing graph ledger", async () => {
      const root = mkdtempSync(join(tmpdir(), "tesbo-bound-source-"));
      const git = (...args: string[]) =>
        execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
      try {
        execFileSync("git", ["init", "-b", "development", root], { stdio: "pipe" });
        git("config", "user.name", "Tesbo graph CI");
        git("config", "user.email", "tesbo-graph@invalid.test");
        mkdirSync(join(root, "src"));
        const content = "export const ready = true;\n";
        writeFileSync(join(root, "src", "feature.ts"), content);
        git("add", "src/feature.ts");
        git("commit", "-m", "initial source");
        await admin.query(
          `INSERT INTO project_source_bindings
             (project_id, repository_id, checkout_key, ref_name, selection_prefixes, enabled)
           VALUES ($1, 'fixture/repository', 'fixture-approved', 'development', ARRAY['src'], true)`,
          [project]
        );
        const db = new DatabaseService(pool);
        const bindings = new ProjectSourceBindingReader(db, {
          "fixture-approved": { repositoryId: "fixture/repository", root }
        });
        const coordinator = new ProjectSourceGraphCoordinator(bindings, store);
        const first = await coordinator.captureForUser(user, project);
        expect(first.stored).toBe(true);
        expect(first.reviewReceipt).toBeNull(); // Native-only -> source scope discontinuity.
        const captured = (await admin.query(
          "SELECT capture_json, review_receipt_json FROM graph_capture_history WHERE id=$1",
          [first.id]
        )).rows[0];
        expect(captured.capture_json.observedCommitSha).toBe(git("rev-parse", "HEAD"));
        expect(captured.capture_json.snapshot.nodes.some((node: { type: string }) =>
          node.type === "implementation_file")).toBe(true);
        expect(captured.capture_json.conceptInventoryStatus).toBe("unverified");
        expect(captured.review_receipt_json).toBeNull();
        const count = (await admin.query(
          "SELECT COUNT(*)::int AS count FROM graph_capture_history WHERE project_id=$1",
          [project]
        )).rows[0].count;
        const retry = await coordinator.captureForUser(user, project);
        expect(retry.stored).toBe(false);
        expect(retry.id).toBe(first.id);
        expect((await admin.query(
          "SELECT COUNT(*)::int AS count FROM graph_capture_history WHERE project_id=$1",
          [project]
        )).rows[0].count).toBe(count);

        writeFileSync(join(root, "src", "feature.ts"), "export const ready = false;\n");
        git("add", "src/feature.ts");
        git("commit", "-m", "changed implementation");
        const next = await coordinator.captureForUser(user, project);
        expect(next.stored).toBe(true);
        expect(next.reviewReceipt?.candidates).toEqual([]);
        expect(next.reviewReceipt?.changed.modifiedNodeIds.some((id) =>
          id.includes("implementation_file"))).toBe(true);
        expect(next.reviewReceipt?.evidence.basis)
          .toBe("verified_source_bytes_unverified_semantics");
        expect(next.reviewReceipt?.evidence.executionAssertion).toBe("none");
        const saved = (await admin.query(
          "SELECT capture_json, review_receipt_json FROM graph_capture_history WHERE id=$1",
          [next.id]
        )).rows[0];
        expect(saved.review_receipt_json.id).toBe(next.reviewReceipt?.id);
        expect(saved.capture_json.observedCommitSha).toBe(git("rev-parse", "HEAD"));

        const row = await bindings.verifyForUser(user, project);
        await expect(store.captureVerifiedImplementationForUser(user, project, {
          ...row, observation: { ...row.observation.value } as never
        })).rejects.toMatchObject({ status: 409 });
        // Ref movement after byte verification and before the DB lock must
        // not write a stale observation over a newer commit.
        writeFileSync(join(root, "src", "feature.ts"), "export const ready = 'newest';\n");
        git("add", "src/feature.ts");
        git("commit", "-m", "advanced while scanner was running");
        const beforeStale = (await admin.query(
          "SELECT COUNT(*)::int AS count FROM graph_capture_history WHERE project_id=$1", [project]
        )).rows[0].count;
        await expect(store.captureVerifiedImplementationForUser(user, project, row))
          .rejects.toMatchObject({ status: 409 });
        expect((await admin.query(
          "SELECT COUNT(*)::int AS count FROM graph_capture_history WHERE project_id=$1", [project]
        )).rows[0].count).toBe(beforeStale);
        await admin.query(
          "UPDATE project_source_bindings SET ref_name='main' WHERE project_id=$1",
          [project]
        );
        await expect(store.captureVerifiedImplementationForUser(user, project, row))
          .rejects.toMatchObject({ status: 409 });
        await admin.query("UPDATE project_source_bindings SET ref_name='development' WHERE project_id=$1", [project]);

        // A new selected source scope is a discontinuity, never an empty change.
        await admin.query(
          "UPDATE project_source_bindings SET selection_prefixes=ARRAY['src/feature.ts'] WHERE project_id=$1",
          [project]
        );
        const repointed = await coordinator.captureForUser(user, project);
        expect(repointed.stored).toBe(true);
        expect(repointed.reviewReceipt).toBeNull();
        const latest = await store.listForUser(user, project, 1);
        expect(latest[0].changeState).toBe("source_scope_changed");

        // Membership revoked after scanning must not authorize persistence.
        const stale = await bindings.verifyForUser(user, project);
        const beforeRevocation = (await admin.query(
          "SELECT COUNT(*)::int AS count FROM graph_capture_history WHERE project_id=$1", [project]
        )).rows[0].count;
        await admin.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2", [project, user]);
        try {
          // Native requireProjectAccess conceals inaccessible projects as 404.
          await expect(store.captureVerifiedImplementationForUser(user, project, stale))
            .rejects.toMatchObject({ status: 404 });
          expect((await admin.query(
            "SELECT COUNT(*)::int AS count FROM graph_capture_history WHERE project_id=$1", [project]
          )).rows[0].count).toBe(beforeRevocation);
        } finally {
          await admin.query(
            "INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'qa_engineer')",
            [project, user]
          );
        }
        await expect(coordinator.captureForUser(randomUUID(), project))
          .rejects.toMatchObject({ status: 403 });
      } finally {
        await admin.query("DELETE FROM project_source_bindings WHERE project_id=$1", [project]);
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("refuses restricted QA notification delivery after role exclusion or project membership revocation", async () => {
      const db = new DatabaseService(pool);
      const key = `qa_change_review:role-bound:${stamp}`;
      const options = {
        type: "qa_change_review" as const, title: "QA graph impact review",
        dedupeKey: key, memberOf: {
          organizationId: org, projectId: project, projectRoles: ["owner"]
        }
      };
      // An otherwise valid QA member is not an owner; the role filter is enforced
      // in PostgreSQL at INSERT time, not only in the earlier recipient lookup.
      expect(await writeNotifications(db, [user], options)).toBe(0);
      await admin.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2", [project, user]);
      try {
        expect(await writeNotifications(db, [user], {
          ...options, memberOf: { ...options.memberOf, projectRoles: ["qa_engineer", "manager", "owner"] }
        })).toBe(0);
        expect((await admin.query(
          "SELECT COUNT(*)::int AS count FROM notifications WHERE dedupe_key=$1", [key]
        )).rows[0].count).toBe(0);
      } finally {
        await admin.query(
          "INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'qa_engineer')",
          [project, user]
        );
        await admin.query("DELETE FROM notifications WHERE dedupe_key=$1", [key]);
      }
    });

    it("persists only approved owner source settings and denies revoked role without mutation", async () => {
      const database = new DatabaseService(pool);
      const reader = new ProjectSourceBindingReader(database, {
        trusted: { repositoryId: "org/repo", root: "/srv/checkout/approved" }
      });
      const management = new ProjectSourceBindingManagement(database, reader);
      const settings = {
        repositoryId: "org/repo", checkoutKey: "trusted", refName: "development",
        selectionPrefixes: ["src"], enabled: true
      };
      await admin.query("UPDATE project_members SET role='owner' WHERE project_id=$1 AND user_id=$2", [project, user]);
      try {
        expect(await management.getForOwner(user, project)).toEqual({ configured: false, binding: null });
        expect(await management.setForOwner(user, project, settings))
          .toEqual({ configured: true, binding: settings });
        expect(await management.getForOwner(user, project))
          .toEqual({ configured: true, binding: settings });
        expect(JSON.stringify(await management.getForOwner(user, project)))
          .not.toContain("/srv/checkout/approved");

        await admin.query("UPDATE project_members SET role='qa_engineer' WHERE project_id=$1 AND user_id=$2", [project, user]);
        await expect(management.getForOwner(user, project)).rejects.toMatchObject({ status: 403 });
        await expect(management.setForOwner(user, project, { ...settings, enabled: false }))
          .rejects.toMatchObject({ status: 403 });
        expect((await admin.query(
          "SELECT enabled, repository_id FROM project_source_bindings WHERE project_id=$1", [project]
        )).rows[0]).toEqual({ enabled: true, repository_id: "org/repo" });

        await admin.query("UPDATE project_members SET role='owner' WHERE project_id=$1 AND user_id=$2", [project, user]);
        await expect(management.setForOwner(user, project, { ...settings, checkoutKey: "untrusted" }))
          .rejects.toMatchObject({ status: 400 });
        expect(await management.setForOwner(user, project, { ...settings, enabled: false }))
          .toMatchObject({ binding: { enabled: false } });
        expect((await admin.query(
          "SELECT enabled FROM project_source_bindings WHERE project_id=$1", [project]
        )).rows[0].enabled).toBe(false);
      } finally {
        await admin.query("DELETE FROM project_source_bindings WHERE project_id=$1", [project]);
        await admin.query("UPDATE project_members SET role='qa_engineer' WHERE project_id=$1 AND user_id=$2", [project, user]);
      }
    });

    it("delivers a committed change review through native per-user notifications exactly once", async () => {
      const latest = await admin.query(
        `SELECT id::text FROM graph_capture_history
          WHERE project_id=$1 AND review_receipt_json IS NOT NULL
          ORDER BY id DESC LIMIT 1`, [project]
      );
      expect(latest.rows).toHaveLength(1);
      const historyId = latest.rows[0].id as string;
      const dedupeKey = `qa_change_review:${project}:${historyId}`;
      const svc = new GraphChangeReviewDelivery(new DatabaseService(pool), makeLegacy(new DatabaseService(pool)));
      try {
        const first = await svc.deliverForUser(user, project, historyId);
        expect(first).toEqual({ status: "delivered", recipientCount: 1, pendingCount: 0 });
        const second = await svc.deliverForUser(user, project, historyId);
        expect(second).toEqual(first);
        const persisted = await admin.query(
          `SELECT type, link_entity_type, link_entity_id, dedupe_key
             FROM notifications WHERE dedupe_key=$1 AND user_id=$2`,
          [dedupeKey, user]
        );
        expect(persisted.rows).toEqual([{
          type: "qa_change_review",
          link_entity_type: "zyra_change_review",
          link_entity_id: project,
          dedupe_key: dedupeKey
        }]);
        // A missing notification after a committed receipt is recovered
        // without a human identity or duplicate durable rows.
        await admin.query("DELETE FROM notifications WHERE dedupe_key=$1", [dedupeKey]);
        const recovery = new GraphChangeReviewRecovery(new DatabaseService(pool), svc);
        // The recovery service normally scans ALL projects. This suite shares a
        // migrated database with other parallel suites, so isolate the real
        // worker query to its own synthetic project rather than notifying
        // unrelated fixtures or assuming the global backlog has exactly one row.
        const backlog = await admin.query<{ count: number }>(
          `SELECT COUNT(*)::int AS count FROM graph_capture_history h
            WHERE h.project_id=$1::uuid
              AND h.review_receipt_json IS NOT NULL
              AND h.captured_at >= now() - interval '48 hours'
              AND NOT EXISTS (
                SELECT 1 FROM notifications n WHERE n.user_id=$2::uuid
                  AND n.type='qa_change_review'
                  AND n.dedupe_key=('qa_change_review:' || h.project_id::text || ':' || h.id::text)
              )`, [project, user]
        );
        const expected = backlog.rows[0].count;
        expect(expected).toBeGreaterThanOrEqual(1); // Includes the deleted target.
        const recovered = await recovery.runOnce(project);
        expect(recovered).toMatchObject({ eligible: expected, delivered: expected, pending: 0, failed: 0 });
        const repeated = await recovery.runOnce(project);
        expect(repeated).toMatchObject({ eligible: 0, delivered: 0, pending: 0, failed: 0 });
        expect(await svc.recoverCommittedForSystem(project, historyId)).toEqual(first);
        expect((await admin.query(
          "SELECT COUNT(*)::int AS count FROM notifications WHERE dedupe_key=$1 AND user_id=$2",
          [dedupeKey, user]
        )).rows[0].count).toBe(1);

        await expect(svc.deliverForUser(user, project, "0 OR TRUE"))
          .rejects.toMatchObject({ status: 404 });
        await expect(svc.deliverForUser(user, project, "999999999999999999999"))
          .rejects.toMatchObject({ status: 404 });
        await expect(svc.deliverForUser(user, randomUUID(), historyId))
          .rejects.toMatchObject({ status: 404 });
      } finally {
        await admin.query(
          "DELETE FROM notifications WHERE type='qa_change_review' AND link_entity_type='zyra_change_review' AND link_entity_id=$1",
          [project]
        );
      }
    });

  }
);
