import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { render } from "../../../test/render";
import { AuthGateway } from "../auth-gateway";

const demoAction = vi.fn();

describe("AuthGateway", () => {
  it("renders the product gateway without external product-name positioning", () => {
    render(<AuthGateway mode="sign-in" isClerkConfigured={false} demoAction={demoAction} />);
    const positioning = screen.getByTestId("auth-product-positioning");

    expect(screen.getByRole("heading", { name: "Plan work. Read signals. Move together." })).toBeInTheDocument();
    expect(screen.getByText("A shared workspace for plans, engineering signals, decisions, and team context.")).toBeInTheDocument();
    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(screen.getByText("Signals")).toBeInTheDocument();
    expect(screen.getByText("Decisions")).toBeInTheDocument();
    expect(within(positioning).queryByText(/jira/i)).not.toBeInTheDocument();
    expect(within(positioning).queryByText(/github/i)).not.toBeInTheDocument();
    expect(within(positioning).queryByText(/notion/i)).not.toBeInTheDocument();
  });

  it("renders a demo sign-in form when Clerk is not configured", () => {
    render(<AuthGateway mode="sign-in" isClerkConfigured={false} demoAction={demoAction} />);

    expect(screen.getByRole("heading", { name: "Sign in to your workspace" })).toBeInTheDocument();
    expect(screen.getByText("Continue with GitHub")).toBeInTheDocument();
    expect(screen.getByText("Use repository identity first, then import projects from connected repos.")).toBeInTheDocument();
    expect(screen.getByText("GitHub login appears here once Clerk GitHub OAuth is configured. Demo mode stays local for now.")).toBeInTheDocument();
    expect(screen.getByLabelText("Display name")).toBeRequired();
    expect(screen.getByLabelText("Email")).toBeRequired();
    expect(screen.getByRole("button", { name: "Enter workspace" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create demo identity" })).toHaveAttribute("href", "/sign-up");
  });

  it("renders a demo sign-up form variant", () => {
    render(<AuthGateway mode="sign-up" isClerkConfigured={false} demoAction={demoAction} />);

    expect(screen.getByRole("heading", { name: "Create your demo identity" })).toBeInTheDocument();
    expect(screen.getByText("Use a local demo identity to evaluate workspace flows without production auth keys.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create demo identity" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in instead" })).toHaveAttribute("href", "/sign-in");
  });

  it("renders the supplied Clerk auth surface inside the branded gateway", () => {
    render(
      <AuthGateway mode="sign-in" isClerkConfigured demoAction={demoAction}>
        <div data-testid="clerk-slot">Clerk form slot</div>
      </AuthGateway>
    );

    expect(screen.getByTestId("clerk-slot")).toHaveTextContent("Clerk form slot");
    expect(screen.getByText("Secure team identity")).toBeInTheDocument();
    expect(screen.getByText("Continue with GitHub")).toBeInTheDocument();
    expect(screen.queryByLabelText("Display name")).not.toBeInTheDocument();
  });
});
