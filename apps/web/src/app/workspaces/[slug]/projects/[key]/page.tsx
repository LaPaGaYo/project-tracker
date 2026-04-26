import { ProjectDetailContent } from "./project-detail-content";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
  searchParams
}: {
  params: Promise<{
    slug: string;
    key: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug, key } = await params;
  const query = await searchParams;
  return <ProjectDetailContent workspaceSlug={slug} projectKey={key} query={query} />;
}
