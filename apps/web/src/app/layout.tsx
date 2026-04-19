import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ClerkProvider } from "@clerk/nextjs";
import { APP_NAME } from "@the-platform/shared";

import { isClerkConfigured } from "@/server/auth";

import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Phase 2 auth and workspace foundations for a GitHub-native planning platform."
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  const content = isClerkConfigured() ? <ClerkProvider>{children}</ClerkProvider> : children;

  return (
    <html lang="en">
      <body className="bg-planka-bg text-planka-text antialiased">{content}</body>
    </html>
  );
}
