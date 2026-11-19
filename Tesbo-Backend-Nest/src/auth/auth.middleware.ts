import { Injectable, NestMiddleware } from "@nestjs/common";
import type { Response, NextFunction } from "express";
import { AppConfigService } from "../config/app-config.service";
import { AuthenticatedRequest } from "../common/request.types";
import { ApiTokenService } from "./api-token.service";
import { OtpService } from "./otp.service";

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly config: AppConfigService,
    private readonly otpService: OtpService,
    private readonly apiTokens: ApiTokenService
  ) {}

  async use(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
    // An explicit bearer credential is authoritative: it cannot inherit permissions from a browser
    // cookie. So the presence of the header decides which credential is even consulted — an invalid
    // bearer yields an anonymous request rather than falling back to the cookie — and the cookie is
    // never resolved (no session lookup) on a bearer-authenticated call.
    req.userId = null;
    req.apiToken = null;

    const bearer = this.readBearerHeader(req.headers?.authorization);
    if (bearer.present) {
      // authenticate() answers null for an absent token, so no second user-controlled branch is
      // needed between "a bearer was presented" and "a principal was resolved".
      const principal = await this.apiTokens.authenticate(bearer.token);
      req.userId = principal?.userId ?? null;
      req.apiToken = principal
        ? {
            tokenId: principal.tokenId,
            userId: principal.userId,
            projectId: principal.projectId,
            scopes: principal.scopes
          }
        : null;
    } else {
      const sessionToken = req.cookies?.[this.config.sessionCookieName];
      req.userId = sessionToken ? await this.otpService.resolveSession(sessionToken) : null;
    }

    next();
  }

  /**
   * Reads `Authorization: Bearer <token>` without a backtracking regular expression.
   *
   * The previous `/^Bearer\s+(.+)$/i` is polynomial on a long run of whitespace, and the header is
   * attacker-controlled on every request. `present` distinguishes "no bearer credential at all"
   * (fall back to the cookie) from "a bearer credential was presented" — including a bare "Bearer"
   * with no token, which must not silently inherit the cookie session.
   */
  private readBearerHeader(header: string | string[] | undefined): { present: boolean; token: string | null } {
    const value = (Array.isArray(header) ? header[0] : header)?.trim();
    if (!value || value.slice(0, 6).toLowerCase() !== "bearer") return { present: false, token: null };
    const separator = value.slice(6, 7);
    if (separator !== "" && !/\s/.test(separator)) return { present: false, token: null };
    const token = value.slice(6).trim();
    return { present: true, token: token ? token : null };
  }
}
