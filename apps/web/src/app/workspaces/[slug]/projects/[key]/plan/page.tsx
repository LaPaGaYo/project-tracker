import { AppShell } from "@/components/app-shell";
import { PlanView } from "@/features/plan/plan-view";
import { ProjectShell } from "@/features/workspace/project-shell";

import { loadProjectPageData } from "../project-page-data";

export const dynamic = "force-dynamic";

export default async function ProjectPlanPage({
  params
}: {
  params: Promise<{
    slug: string;
    key: string;
  }>;
}) {
  const { slug, key } = await params;
  const { canCreate, isClerkEnabled, notificationInbox, project, session, workspace, workspaces, workspaceView } =
    await loadProjectPageData(slug, key);

  return (
    <AppShell
      currentWorkspaceId={workspace.id}
      isClerkEnabled={isClerkEnabled}
      session={session}
      workspaces={workspaces}
    >
      <ProjectShell
        canCreate={canCreate}
        projectDescription={project.description}
        projectKey={project.key}
        projectTitle={project.title}
        notificationInbox={notificationInbox}
        stage={workspaceView.stage}
        workspaceSlug={slug}
      >
        <PlanView plan={workspaceView.plan} />
      </ProjectShell>
    </AppShell>
  );
}
