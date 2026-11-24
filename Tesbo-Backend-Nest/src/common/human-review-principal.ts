import { ForbiddenException } from "@nestjs/common";

/** Trusted transport identity, never accepted from a request body or token issuer id. */
export type ReviewPrincipal = { kind: "human_session" | "api_token" };

export function requireHumanReviewPrincipal(principal: ReviewPrincipal | undefined): void {
  if (principal?.kind !== "human_session") {
    throw new ForbiddenException({
      code: "HUMAN_REVIEW_REQUIRED",
      error: "This decision requires an authenticated human review session"
    });
  }
}
