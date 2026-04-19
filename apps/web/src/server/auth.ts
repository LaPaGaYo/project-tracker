import { auth as clerkAuth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

import type { AppSession } from "./workspaces/types";

const demoSessionIdCookie = "the_platform_demo_user_id";
const demoSessionEmailCookie = "the_platform_demo_user_email";
const demoSessionNameCookie = "the_platform_demo_user_name";

export function isClerkConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

function buildDemoUserId(email: string) {
  return `demo_${email.replace(/[^a-z0-9]+/g, "_")}`;
}

export async function getAppSession(): Promise<AppSession | null> {
  if (isClerkConfigured()) {
    const auth = await clerkAuth();
    if (!auth.userId) {
      return null;
    }

    const user = await currentUser();
    const email = user?.emailAddresses[0]?.emailAddress ?? null;

    return {
      userId: auth.userId,
      email,
      displayName: user?.fullName ?? user?.firstName ?? email,
      provider: "clerk"
    };
  }

  const cookieStore = await cookies();
  const userId = cookieStore.get(demoSessionIdCookie)?.value;
  const email = cookieStore.get(demoSessionEmailCookie)?.value ?? null;
  const displayName = cookieStore.get(demoSessionNameCookie)?.value ?? email;

  if (!userId) {
    return null;
  }

  return {
    userId,
    email,
    displayName,
    provider: "demo"
  };
}

export async function createDemoSession(input: {
  email: string;
  displayName?: string;
}) {
  const email = input.email.trim().toLowerCase();
  const cookieStore = await cookies();
  const userId = buildDemoUserId(email);
  const displayName = input.displayName?.trim() || email.split("@")[0] || email;

  cookieStore.set(demoSessionIdCookie, userId, {
    httpOnly: true,
    path: "/",
    sameSite: "lax"
  });
  cookieStore.set(demoSessionEmailCookie, email, {
    httpOnly: true,
    path: "/",
    sameSite: "lax"
  });
  cookieStore.set(demoSessionNameCookie, displayName, {
    httpOnly: true,
    path: "/",
    sameSite: "lax"
  });
}

export async function clearDemoSession() {
  const cookieStore = await cookies();

  cookieStore.delete(demoSessionIdCookie);
  cookieStore.delete(demoSessionEmailCookie);
  cookieStore.delete(demoSessionNameCookie);
}
