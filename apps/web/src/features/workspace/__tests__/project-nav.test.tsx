import { screen } from "@testing-library/react";
import type { WorkspaceSummary } from "@the-platform/shared";
import { describe, expect, it } from "vitest";

import { AppShell } from "../../../components/app-shell";
import { render } from "../../../test/render";
import type { AppSession } from "../../../server/workspaces/types";

const session: AppSession = {
  userId: "user-1",
  email: "henry@example.com",
  displayName: "Henry",
  provider: "demo"
};

const workspaces: WorkspaceSummary[] = [
  {
    id: "workspace-1",
    name: "Platform Ops",
    slug: "platform-ops",
    role: "owner",
    createdAt: "2026-04-20T12:00:00.000Z",
    updatedAt: "2026-04-20T12:00:00.000Z"
  },
  {
    id: "workspace-2",
    name: "Growth Lab",
    slug: "growth-lab",
    role: "member",
    createdAt: "2026-04-20T12:00:00.000Z",
    updatedAt: "2026-04-20T12:00:00.000Z"
  }
];

describe("AppShell workspace navigation", () => {
  it("highlights the active workspace chip and keeps the sign out control visible", () => {
    render(
      <AppShell
        currentWorkspaceId="workspace-1"
        isClerkEnabled={false}
        session={session}
        workspaces={workspaces}
      >
        <div>Board content</div>
      </AppShell>
    );

    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Platform Ops" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Growth Lab" })).not.toHaveAttribute("aria-current");
  });
});
