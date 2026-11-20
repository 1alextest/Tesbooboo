"use client";

import { RouteParamsProvider, useParams } from "@/lib/routeParams";
import { ProjectDataProvider } from "@/components/project/ProjectDataProvider";
import { useAppData } from "@/components/app/AppDataProvider";

function ProjectShell({ children }: { children: React.ReactNode }) {
  // Resolved by RouteParamsProvider: a uuid even when the URL carries the project key.
  const params = useParams();
  const projectId = params.id as string;
  return <ProjectDataProvider projectId={projectId}>{children}</ProjectDataProvider>;
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAppData();
  return (
    <RouteParamsProvider userId={currentUser?.userId}>
      <ProjectShell>{children}</ProjectShell>
    </RouteParamsProvider>
  );
}
