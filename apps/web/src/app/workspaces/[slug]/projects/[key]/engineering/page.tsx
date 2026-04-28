import { AppShell } from "@/components/app-shell";
import { EngineeringView } from "@/features/engineering/engineering-view";
import { GithubImportPanel } from "@/features/github-import/github-import-panel";
import { ProjectShell } from "@/features/workspace/project-shell";
import {
  buildGithubAppInstallUrl,
  getGithubAppMissingConfiguration,
} from "@/server/github/app-installation";
import { getGithubUserAuthorizationMissingConfiguration } from "@/server/github/user-authorization";

import { loadProjectPageData } from "../project-page-data";

export const dynamic = "force-dynamic";

function resolveGithubInstallUrl(workspaceSlug: string) {
  const appSlug = process.env.GITHUB_APP_SLUG?.trim();
  if (!appSlug) {
    return null;
  }

  return buildGithubAppInstallUrl({
    appSlug,
    workspaceSlug,
  });
}

export default async function ProjectEngineeringPage({
  params,
}: {
  params: Promise<{
    slug: string;
    key: string;
  }>;
}) {
  const { slug, key } = await params;
  const {
    canCreate,
    isClerkEnabled,
    membership,
    notificationInbox,
    project,
    session,
    workspace,
    workspaces,
    workspaceView,
  } = await loadProjectPageData(slug, key);
  const canImport = membership.role === "owner" || membership.role === "admin";
  const missingConfiguration = [
    ...getGithubAppMissingConfiguration(),
    ...getGithubUserAuthorizationMissingConfiguration(),
  ];

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
        <div className="grid gap-6">
          <EngineeringView engineering={workspaceView.engineering} />
          <GithubImportPanel
            workspaceSlug={slug}
            projectKey={project.key}
            canImport={canImport}
            installUrl={resolveGithubInstallUrl(slug)}
            authorizationUrl={null}
            authorizationStatus="not_required"
            authorizationErrorCode={null}
            authorizedGithubLogin={null}
            installationId={null}
            repositories={[]}
            errorMessage={null}
            missingConfiguration={missingConfiguration}
          />
        </div>
      </ProjectShell>
    </AppShell>
  );
}
