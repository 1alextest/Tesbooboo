import { applyDecorators, CanActivate, ExecutionContext, Injectable, SetMetadata, UseGuards } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedRequest } from "../common/request.types";
import { LegacyService, type PlanRunWriteTarget } from "./legacy.service";

const WRITE_TARGET = "legacy:plan-run-write-target";

/** Transport adapter only: authorization and entitlement remain with their existing owners. */
@Injectable()
export class PlanRunWriteLockGuard implements CanActivate {
  constructor(private readonly legacy: LegacyService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const target = this.reflector.get<PlanRunWriteTarget>(WRITE_TARGET, context.getHandler());
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    await this.legacy.assertPlanRunRestWritable(req.userId, target, req.params, req.body);
    return true;
  }
}

/** Applied to exactly the implemented alias mutations, before multipart interceptors run. */
export function PlanRunWrite(target: PlanRunWriteTarget) {
  return applyDecorators(SetMetadata(WRITE_TARGET, target), UseGuards(PlanRunWriteLockGuard));
}
