"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "@/lib/routeParams";

/**
 * Scheduled runs are not implemented server-side: the schedule routes answer 501, the
 * cycle_run_schedules table is unused, and there is no runner. The create form that used to live
 * here could only end in "Scheduled runs are not available yet", so it has been removed.
 *
 * The URL still exists as a redirect rather than a 404: someone with the old page bookmarked (or a
 * stale tab open) should land on the test runs list, not on a missing page. The module also stays
 * in the static dependency graph, whose impact planner treats a deleted module as incomplete
 * consumer evidence requiring review.
 */
export default function RemovedScheduleRunsPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  useEffect(() => {
    router.replace(`/projects/${projectId}/cycles`);
  }, [router, projectId]);

  return (
    <main className="p-5 text-[13px] text-[var(--muted)]">
      Scheduled runs are not available yet. Returning to test runs…
    </main>
  );
}
