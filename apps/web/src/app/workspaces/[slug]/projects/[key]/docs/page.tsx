import { AppShell } from "@/components/app-shell";
import { DocsView } from "@/features/docs/docs-view";
import { ProjectShell } from "@/features/workspace/project-shell";
import { buildProjectWorkspaceContent } from "@/lib/content/project-workspace";

import { loadProjectPageData } from "../project-page-data";

export const dynamic = "force-dynamic";

export default async function ProjectDocsPage({
  params
}: {
  params: Promise<{
    slug: string;
    key: string;
  }>;
}) {
  const { slug, key } = await params;
  const { canCreate, isClerkEnabled, project, session, workspace, workspaces, workspaceView } =
    await loadProjectPageData(slug, key);
  const content = buildProjectWorkspaceContent(project, workspaceView);

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
        stage={workspaceView.stage}
        workspaceSlug={slug}
      >
        <DocsView docs={content.docs} />
      </ProjectShell>
    </AppShell>
  );
}
