"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "@/lib/routeParams";
import { PageLoader } from "@/components/ui";

// The project route provider resolves either readable references or UUIDs. Reuse the
// existing repository editor, but keep the exact resolved test case instead of dropping it.
export default function TestCaseDetailPage() {
  const { id, tcId } = useParams<{ id: string; tcId: string }>();
  const router = useRouter();
  useEffect(() => {
    if (id && tcId) router.replace(`/projects/${encodeURIComponent(id)}/testcases?testcaseId=${encodeURIComponent(tcId)}`);
  }, [id, tcId, router]);
  return <PageLoader label="Opening linked test case…" />;
}
