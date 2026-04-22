import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ViewToggle } from "../../../components/view-toggle";

const replace = vi.hoisted(() => vi.fn());
const usePathname = vi.hoisted(() => vi.fn());
const useRouter = vi.hoisted(() => vi.fn());
const useSearchParams = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname,
  useRouter,
  useSearchParams
}));

vi.mock("../../../components/board-view", () => ({
  BoardView: () => <div>Board surface</div>
}));

vi.mock("../../../components/list-view", () => ({
  ListView: () => <div>List surface</div>
}));

vi.mock("../../../components/filter-bar", () => ({
  FilterBar: () => <div>Filter bar</div>
}));

vi.mock("../../../components/detail-panel", () => ({
  DetailPanel: () => <div>Detail panel</div>
}));

const localStorageMock = {
  clear: vi.fn(),
  getItem: vi.fn(),
  removeItem: vi.fn(),
  setItem: vi.fn()
};

afterEach(() => {
  replace.mockReset();
  usePathname.mockReset();
  useRouter.mockReset();
  useSearchParams.mockReset();
  localStorageMock.clear.mockReset();
  localStorageMock.getItem.mockReset();
  localStorageMock.removeItem.mockReset();
  localStorageMock.setItem.mockReset();
});

describe("ViewToggle", () => {
  it("replays a stored list preference into the URL so the toolbar can stay in sync", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: localStorageMock
    });
    localStorageMock.getItem.mockReturnValue("list");
    useRouter.mockReturnValue({ push: vi.fn(), replace });
    usePathname.mockReturnValue("/workspaces/platform-ops/projects/OPS");
    useSearchParams.mockReturnValue(new URLSearchParams(""));

    render(
      <ViewToggle
        workspaceSlug="platform-ops"
        projectKey="OPS"
        basePath="/workspaces/platform-ops/projects/OPS"
        items={[]}
        members={[]}
        states={[]}
        sessionUserId="user-1"
        membershipRole="owner"
      />
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/workspaces/platform-ops/projects/OPS?view=list", { scroll: false });
    });
    expect(screen.getByText("List surface")).toBeInTheDocument();
  });

  it("does not override an explicit board route with the stored list preference", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: localStorageMock
    });
    localStorageMock.getItem.mockReturnValue("list");
    useRouter.mockReturnValue({ push: vi.fn(), replace });
    usePathname.mockReturnValue("/workspaces/platform-ops/projects/OPS");
    useSearchParams.mockReturnValue(new URLSearchParams("view=board"));

    render(
      <ViewToggle
        workspaceSlug="platform-ops"
        projectKey="OPS"
        basePath="/workspaces/platform-ops/projects/OPS"
        items={[]}
        members={[]}
        states={[]}
        sessionUserId="user-1"
        membershipRole="owner"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Board surface")).toBeInTheDocument();
    });
    expect(replace).not.toHaveBeenCalledWith("/workspaces/platform-ops/projects/OPS?view=list", { scroll: false });
  });

  it("keeps the selected item route when switching from board to list", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: localStorageMock
    });
    localStorageMock.getItem.mockReturnValue("board");
    useRouter.mockReturnValue({ push: vi.fn(), replace });
    usePathname.mockReturnValue("/workspaces/platform-ops/projects/OPS/items/OPS-1");
    useSearchParams.mockReturnValue(new URLSearchParams("view=board"));

    render(
      <ViewToggle
        workspaceSlug="platform-ops"
        projectKey="OPS"
        basePath="/workspaces/platform-ops/projects/OPS"
        items={[]}
        members={[]}
        states={[]}
        sessionUserId="user-1"
        membershipRole="owner"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "list" }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        "/workspaces/platform-ops/projects/OPS/items/OPS-1?view=list",
        { scroll: false }
      );
    });
  });
});
