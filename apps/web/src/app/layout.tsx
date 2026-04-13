import type { Metadata } from "next";
import type { ReactNode } from "react";

import { APP_NAME } from "@the-platform/shared";

import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Phase 1 foundation for a GitHub-native planning platform."
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className="bg-planka-bg text-planka-text antialiased">{children}</body>
    </html>
  );
}
