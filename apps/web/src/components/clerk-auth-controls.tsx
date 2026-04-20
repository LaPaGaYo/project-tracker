"use client";

import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export function ClerkGuestButtons() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SignInButton mode="modal">
        <button className="rounded-full border border-white/12 px-4 py-2 text-sm font-semibold text-planka-text transition hover:border-white/24 hover:bg-white/6">
          Sign in
        </button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button className="rounded-full bg-planka-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-planka-accent-hover">
          Create account
        </button>
      </SignUpButton>
    </div>
  );
}

export function ClerkUserMenu() {
  return <UserButton />;
}
