import Link from "next/link";

import { SignUp } from "@clerk/nextjs";

import { signInDemoAction } from "@/app/actions";
import { isClerkConfigured } from "@/server/auth";

export default function SignUpPage() {
  if (isClerkConfigured()) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-16">
        <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
      <div className="w-full rounded-[2rem] border border-white/8 bg-planka-card/75 p-8 shadow-[0_32px_120px_rgba(0,0,0,0.24)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">Demo Auth</p>
        <h1 className="mt-4 text-3xl font-semibold text-planka-text">Create a demo identity</h1>
        <p className="mt-4 text-sm leading-7 text-planka-text-muted">
          Without Clerk keys, sign up runs in demo mode so Phase 2 workspace flows remain testable locally.
        </p>
        <form action={signInDemoAction} className="mt-6 grid gap-4">
          <input
            required
            name="displayName"
            placeholder="Display name"
            className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 text-sm outline-none"
          />
          <input
            required
            type="email"
            name="email"
            placeholder="you@example.com"
            className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 text-sm outline-none"
          />
          <button className="rounded-2xl bg-planka-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-planka-accent-hover">
            Create demo account
          </button>
        </form>
        <p className="mt-6 text-sm text-planka-text-muted">
          Already have a demo identity?{" "}
          <Link href="/sign-in" className="font-semibold text-planka-text">
            Sign in here
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
