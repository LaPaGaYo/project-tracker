import { redirect } from "next/navigation";

import { getAppSession } from "@/server/auth";
import { resolveGithubSetupRedirect } from "@/server/github/setup";

export const dynamic = "force-dynamic";

export default async function GithubSetupPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAppSession();
  if (!session) {
    redirect("/sign-in");
  }

  const resolvedSearchParams = await searchParams;
  const nextParams = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (typeof value === "string") {
      nextParams.set(key, value);
    }
  }

  redirect(resolveGithubSetupRedirect(nextParams));
}
