import type { ReactNode } from "react";
import Link from "next/link";

type AuthMode = "sign-in" | "sign-up";
type DemoAction = (formData: FormData) => void | Promise<void>;

interface AuthGatewayProps {
  mode: AuthMode;
  isClerkConfigured: boolean;
  demoAction: DemoAction;
  children?: ReactNode;
}

const capabilityCards = [
  {
    eyebrow: "Plan",
    title: "Turn strategy into staged work",
    detail: "Keep stages, ownership, and readiness visible before the team commits."
  },
  {
    eyebrow: "Signals",
    title: "See delivery health in context",
    detail: "Bring pull requests, checks, deploys, and blockers into the same workspace view."
  },
  {
    eyebrow: "Decisions",
    title: "Carry alignment with the work",
    detail: "Capture lightweight context so handoffs stay close to execution."
  }
];

export function AuthGateway({ children, demoAction, isClerkConfigured, mode }: AuthGatewayProps) {
  const isSignUp = mode === "sign-up";
  const heading = isSignUp ? "Create your demo identity" : "Sign in to your workspace";
  const supportingText = isSignUp
    ? "Use a local demo identity to evaluate workspace flows without production auth keys."
    : "Enter the workspace where plans, delivery signals, and team context stay connected.";
  const submitLabel = isSignUp ? "Create demo identity" : "Enter workspace";
  const alternateHref = isSignUp ? "/sign-in" : "/sign-up";
  const alternateLabel = isSignUp ? "Sign in instead" : "Create demo identity";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1e2227] px-5 py-6 text-planka-text sm:px-8 lg:px-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_12%,rgba(33,133,208,0.38),transparent_28%),radial-gradient(circle_at_82%_82%,rgba(242,187,87,0.2),transparent_26%),linear-gradient(180deg,#2a2f35_0%,#1e2227_65%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.9)_1px,transparent_1px)] [background-size:180px_180px]" />

      <section className="relative mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#22262c]/88 shadow-[0_44px_160px_rgba(0,0,0,0.42)] backdrop-blur-xl lg:grid-cols-[1.2fr_0.8fr]">
        <div
          data-testid="auth-product-positioning"
          className="relative flex min-h-[640px] flex-col justify-between p-8 sm:p-12 lg:p-16"
        >
          <div>
            <Link
              href="/"
              className="inline-flex items-center rounded-full border border-sky-300/20 bg-sky-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.28em] text-sky-200"
            >
              The Platform
            </Link>

            <div className="mt-16 max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.34em] text-planka-text-muted">Team operating layer</p>
              <h1 className="mt-5 max-w-2xl text-5xl font-black leading-[0.95] tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl">
                Plan work. Read signals. Move together.
              </h1>
              <p className="mt-7 max-w-2xl text-lg font-semibold leading-8 text-planka-text-muted">
                A shared workspace for plans, engineering signals, decisions, and team context.
              </p>
            </div>
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {capabilityCards.map((card) => (
              <article
                key={card.eyebrow}
                className="rounded-[1.5rem] border border-white/9 bg-black/22 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
              >
                <p className="text-xs font-black uppercase tracking-[0.26em] text-sky-300">{card.eyebrow}</p>
                <h2 className="mt-4 text-lg font-black leading-6 text-white">{card.title}</h2>
                <p className="mt-3 text-sm font-semibold leading-6 text-planka-text-muted">{card.detail}</p>
              </article>
            ))}
          </div>
        </div>

        <aside className="relative flex items-center justify-center bg-[#f2ede3] p-6 text-[#202327] sm:p-10 lg:p-14">
          <div className="absolute inset-x-8 top-8 flex items-center justify-between text-xs font-black uppercase tracking-[0.24em] text-[#777167]">
            <span>{isClerkConfigured ? "Secure team identity" : "Demo mode"}</span>
            <span>Workspace access</span>
          </div>

          <div className="w-full max-w-md rounded-[2rem] border border-black/8 bg-[#fbf8f1] p-7 shadow-[0_28px_90px_rgba(32,35,39,0.22)] sm:p-9">
            <div className="mb-8">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-[#2185d0]">
                {isSignUp ? "Start here" : "Welcome back"}
              </p>
              <h2 className="mt-4 text-4xl font-black tracking-[-0.05em] text-[#202327]">{heading}</h2>
              <p className="mt-4 text-sm font-bold leading-6 text-[#646b74]">{supportingText}</p>
            </div>

            <div className="mb-5 rounded-[1.4rem] border border-black/8 bg-[#202327] p-4 text-white shadow-[0_18px_50px_rgba(32,35,39,0.18)]">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-white text-lg font-black text-[#202327]">
                  G
                </span>
                <div>
                  <p className="text-sm font-black">Continue with GitHub</p>
                  <p className="mt-1 text-xs font-bold leading-5 text-white/62">
                    Use repository identity first, then import projects from connected repos.
                  </p>
                </div>
              </div>
              {!isClerkConfigured ? (
                <p className="mt-4 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-xs font-bold leading-5 text-white/68">
                  GitHub login appears here once Clerk GitHub OAuth is configured. Demo mode stays local for now.
                </p>
              ) : null}
            </div>

            {isClerkConfigured ? (
              <div className="rounded-[1.5rem] border border-black/8 bg-white p-4 shadow-[0_16px_60px_rgba(32,35,39,0.1)]">
                {children}
              </div>
            ) : (
              <form action={demoAction} className="grid gap-4">
                <label className="grid gap-2 text-sm font-black text-[#30353b]">
                  Display name
                  <input
                    required
                    name="displayName"
                    placeholder="Henry"
                    className="rounded-2xl border border-black/10 bg-[#ebe5da] px-4 py-3 text-base font-bold text-[#202327] outline-none transition placeholder:text-[#7a746b] focus:border-[#2185d0] focus:bg-white"
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-[#30353b]">
                  Email
                  <input
                    required
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    className="rounded-2xl border border-black/10 bg-[#ebe5da] px-4 py-3 text-base font-bold text-[#202327] outline-none transition placeholder:text-[#7a746b] focus:border-[#2185d0] focus:bg-white"
                  />
                </label>
                <button className="mt-2 rounded-2xl bg-[#2185d0] px-5 py-4 text-base font-black text-white shadow-[0_16px_36px_rgba(33,133,208,0.28)] transition hover:bg-[#1e70bf]">
                  {submitLabel}
                </button>
              </form>
            )}

            <div className="mt-7 flex items-center justify-between gap-4 rounded-2xl bg-[#ebe5da] px-4 py-3 text-sm font-black text-[#646b74]">
              <span>{isSignUp ? "Already have access?" : "New workspace?"}</span>
              <Link href={alternateHref} className="text-[#202327] underline decoration-[#2185d0]/30 underline-offset-4">
                {alternateLabel}
              </Link>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
