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
    // Explicit bearer credentials cannot inherit permissions from a browser cookie.
    const authorization = req.headers?.authorization;
    const rawHeader = Array.isArray(authorization) ? authorization[0] : authorization;
    const presentingBearer = /^Bearer(?:\\s|$)/i.test(rawHeader?.trim() ?? "");
    req.userId = null;
    req.apiToken = null;

    if (presentingBearer) {
      const bearer = this.extractBearerToken(authorization);
      const principal = bearer ? await this.apiTokens.authenticate(bearer) : null;
      if (principal) {
        req.userId = principal.userId;
        req.apiToken = {
          tokenId: principal.tokenId,
          userId: principal.userId,
          projectId: principal.projectId,
          scopes: principal.scopes
        };
      }
    } else {
      const sessionToken = req.cookies?.[this.config.sessionCookieName];
      req.userId = sessionToken ? await this.otpService.resolveSession(sessionToken) : null;
    }

    next();
  }

  private extractBearerToken(header: string | string[] | undefined): string | null {
    const value = Array.isArray(header) ? header[0] : header;
    if (!value) return null;
    const match = /^Bearer\s+(.+)$/i.exec(value.trim());
    return match ? match[1].trim() : null;
  }
}
