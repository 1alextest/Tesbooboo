import { Controller, Get } from "@nestjs/common";
import { BUILD_GIT_SHA } from "../build-provenance";

// The running commit is resolved in one place — see build-provenance.ts, which accepts the
// Jenkins/docker-compose GIT_SHA and Railway's RAILWAY_GIT_COMMIT_SHA. "local" is the honest answer
// when neither deploy path identified the build. Added after a nightly-cron incident where two
// backend instances (one several commits stale) were independently running the same scheduled job
// against the same database with no way to tell them apart short of DB forensics — comparing this
// field across every environment pointed at one DATABASE_URL is the fast version of that check.
const GIT_SHA = BUILD_GIT_SHA;

@Controller()
export class HealthController {
  @Get("/health")
  health() {
    return { status: "ok", gitSha: GIT_SHA };
  }

  @Get("/api/health")
  apiHealth() {
    return { status: "ok", gitSha: GIT_SHA };
  }
}
