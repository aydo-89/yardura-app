"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

import {
  ThemeProvider,
  type ThemeName,
} from "@/components/theme/ThemeProvider";

interface ProvidersProps {
  children: React.ReactNode;
  initialTheme: ThemeName;
  session?: Session | null;
}

export default function Providers({
  children,
  initialTheme,
  session,
}: ProvidersProps) {
  return (
    <SessionProvider session={session}>
      <ThemeProvider initialTheme={initialTheme}>
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
