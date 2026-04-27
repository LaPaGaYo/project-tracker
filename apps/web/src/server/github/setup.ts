const workspaceSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function resolveGithubSetupRedirect(searchParams: URLSearchParams) {
  const state = searchParams.get("state")?.trim() ?? "";
  const installationId = searchParams.get("installation_id")?.trim() ?? "";
  const setupAction = searchParams.get("setup_action")?.trim() ?? "";

  if (!workspaceSlugPattern.test(state)) {
    return "/";
  }

  if (installationId) {
    const params = new URLSearchParams({
      workspaceSlug: state,
      githubInstallationId: installationId,
    });
    if (setupAction) {
      params.set("githubSetupAction", setupAction);
    }
    return `/github/authorize?${params.toString()}`;
  }

  const params = new URLSearchParams();
  if (setupAction) {
    params.set("githubSetupAction", setupAction);
  }

  const query = params.toString();
  return `/workspaces/${state}/projects${query ? `?${query}` : ""}`;
}
