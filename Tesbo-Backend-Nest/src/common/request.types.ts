import type { Request } from "express";

/** Identity/scope attached when a request authenticates via an API bearer token. */
export type ApiTokenContext = {
  tokenId: string;
  /** The human user the token was issued by (used where a column references users(id)). */
  userId: string | null;
  projectId: string | null;
  scopes: string[];
};

/**
 * Reserved for a future OAuth resource-server verifier. No current request can
 * receive this principal: OAuth issuance and access-token validation are OFF.
 *
 * Distinguish the OAuth AS issuer ("iss") from the Tesbo user/producer issuerId.
 * In particular, never populate req.apiToken or req.userId as a substitute for
 * a verified OAuth machine principal: REST guards would then misclassify it.
 */
export type OAuthMachineContext = {
  kind: "oauth_access";
  issuer: string;
  subject: string;
  clientId: string;
  grantId: string;
  userId: string;
  projectId: string;
  resource: string;
  scopes: string[];
};

export type AuthenticatedRequest = Request & {
  userId?: string | null;
  /** Present only for requests authenticated with an API token (machine clients). */
  apiToken?: ApiTokenContext | null;
  /** Not populated until a separately reviewed resource-server verifier exists. */
  oauthAccess?: OAuthMachineContext | null;
  /** Raw request body bytes, captured for Stripe webhook signature verification. */
  rawBody?: Buffer;
};
