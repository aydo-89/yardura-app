import { ReactNode } from "react";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Yardura App",
  description: "Your smart yard care companion",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Yardura",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f172a", // slate-900
};

export default function MobileLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900">
      {children}
    </div>
  );
}



