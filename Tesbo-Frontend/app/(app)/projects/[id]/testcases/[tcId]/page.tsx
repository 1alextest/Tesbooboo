import { redirect } from "next/navigation";

// Next 15+ passes route params as a Promise, so this has to be awaited.
type TestCaseDetailRouteProps = {
  params: Promise<{
    id: string;
    tcId: string;
  }>;
};

export default async function TestCaseDetailPage({ params }: TestCaseDetailRouteProps) {
  const { id, tcId } = await params;
  // Keep the repository's existing editor as the one case-detail owner.
  redirect(`/projects/${encodeURIComponent(id)}/testcases?caseId=${encodeURIComponent(tcId)}`);
}
