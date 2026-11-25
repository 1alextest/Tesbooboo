import type { DatabaseService } from "../database/database.service";
import { oauthReferenceFingerprint } from "../common/crypto.util";
import { isOAuthMcpGrant, readMcpAccess } from "../mcp/mcp-access";

/**
 * A grant binding is evidence that the user completed consent under one
 * exact existing project-owner approval revision. It NEVER supplies authority
 * on its own: the current owner settings remain the only permission source.
 *
 * The grant id is never stored or logged in plaintext; a revoked binding remains a permanent tombstone. Every resource/token
 * read must verify the binding AND the owner's current grant.
 */
export type OAuthGrantBasis = {
  projectId: string;
  accountId: string;
  clientId: string;
  resource: string;
  approvalRevision: number;
  /** The exact human membership generation approved on the consent page. */
  projectMembershipId?: string;
  organizationMembershipId?: string;
};

function fingerprint(grantId: string): string {
  if (typeof grantId !== "string" || !grantId || grantId.length > 8192) throw new Error("Invalid OAuth grant reference");
  return oauthReferenceFingerprint("oauth:Grant:id", grantId);
}

function approved(settings: unknown, clientId: string, revision: number): boolean {
  const access = readMcpAccess(settings);
  if (!access.enabled || access.revision !== revision) return false;
  const grant = access.clients.find(value => isOAuthMcpGrant(value) && value.oauthClientId === clientId);
  return !!grant && isOAuthMcpGrant(grant) && grant.scopes.length === 1 && grant.scopes[0] === "read"
    && (!grant.expiresAt || Date.parse(grant.expiresAt) > Date.now());
}

/** The exact, current owner revision and the recorded human-consent facts must agree. */
export async function currentOAuthGrantBinding(
  db: Pick<DatabaseService, "query">, grantId: string, expected?: Partial<OAuthGrantBasis>
): Promise<boolean> {
  try {
    const row = (await db.query(
      `SELECT b.project_id,b.account_id,b.client_id,b.resource,b.approval_revision,p.settings
         FROM mcp_oauth_grant_approval_bindings b
         JOIN projects p ON p.id=b.project_id AND p.archived_at IS NULL
         JOIN project_members pm ON pm.project_id=b.project_id AND pm.user_id::text=b.account_id
            AND pm.id=b.project_membership_id
         JOIN organization_members om ON om.organization_id=p.organization_id AND om.user_id::text=b.account_id
            AND om.id=b.organization_membership_id
        WHERE b.grant_fingerprint=$1 AND b.revoked_at IS NULL`,
      [fingerprint(grantId)]
    )).rows[0];
    if (!row || !Number.isSafeInteger(Number(row.approval_revision)) ||
        (expected?.projectId !== undefined && row.project_id !== expected.projectId) ||
        (expected?.accountId !== undefined && row.account_id !== expected.accountId) ||
        (expected?.clientId !== undefined && row.client_id !== expected.clientId) ||
        (expected?.resource !== undefined && row.resource !== expected.resource) ||
        (expected?.approvalRevision !== undefined && Number(row.approval_revision) !== expected.approvalRevision)) return false;
    return approved(row.settings, String(row.client_id), Number(row.approval_revision));
  } catch {
    // Missing storage, disabled projects, invalid secrets and database outages
    // are authorization failures, never implicit permission to continue.
    return false;
  }
}

/**
 * Bind the new provider Grant after the human's positive consent, under the
 * project row lock. A concurrent owner update either wins and refuses this
 * stale consent or follows and irrevocably invalidates its binding.
 */
export async function bindOAuthGrantToApproval(
  db: Pick<DatabaseService, "transaction">, grantId: string, basis: OAuthGrantBasis
): Promise<void> {
  if (!Number.isSafeInteger(basis.approvalRevision) || basis.approvalRevision < 0 ||
      !basis.accountId || !basis.clientId || !basis.projectId || !basis.resource ||
      ((basis.projectMembershipId === undefined) !== (basis.organizationMembershipId === undefined))) {
    throw new Error("Incomplete OAuth consent approval basis");
  }
  const grantFingerprint = fingerprint(grantId);
  await db.transaction(async client => {
    const row = (await client.query(
      `SELECT p.settings,pm.id AS project_membership_id,om.id AS organization_membership_id FROM projects p
         JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$2
         JOIN organization_members om ON om.organization_id=p.organization_id AND om.user_id=$2
        WHERE p.id=$1 AND p.archived_at IS NULL
        FOR SHARE OF p,pm,om`,
      [basis.projectId, basis.accountId]
    )).rows[0];
    if (!row || typeof row.project_membership_id !== "string" ||
        typeof row.organization_membership_id !== "string" ||
        (basis.projectMembershipId !== undefined &&
          (row.project_membership_id !== basis.projectMembershipId ||
           row.organization_membership_id !== basis.organizationMembershipId)) ||
        !approved(row.settings, basis.clientId, basis.approvalRevision)) {
      throw new Error("OAuth owner approval or project membership changed during consent");
    }
    const inserted = await client.query(
      `INSERT INTO mcp_oauth_grant_approval_bindings
         (grant_fingerprint,project_id,account_id,client_id,resource,approval_revision,
          project_membership_id,organization_membership_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING grant_fingerprint`,
      [grantFingerprint,basis.projectId,basis.accountId,basis.clientId,basis.resource,basis.approvalRevision,
       row.project_membership_id,row.organization_membership_id]
    );
    if (inserted.rows.length !== 1) throw new Error("OAuth consent grant identity already bound");
  });
}
