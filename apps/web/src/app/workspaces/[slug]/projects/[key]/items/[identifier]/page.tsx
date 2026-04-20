import { ProjectDetailContent } from "../../project-detail-content";

export const dynamic = "force-dynamic";

export default async function ProjectItemDetailPage({
  params,
  searchParams
}: {
  params: Promise<{
    slug: string;
    key: string;
    identifier: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug, key, identifier } = await params;
  const query = await searchParams;

  return (
    <ProjectDetailContent
      workspaceSlug={slug}
      projectKey={key}
      query={query}
      selectedIdentifier={identifier}
    />
  );
}
