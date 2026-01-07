"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ChevronLeft, LogOut, Settings2 } from "lucide-react";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface MobileHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export function MobileHeader({ title, showBack = false, onBack }: MobileHeaderProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { theme } = useTheme();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/signin" });
  };

  const userRole = (session as any)?.userRole ?? (session?.user as any)?.role ?? "USER";
  const roleDisplay =
    userRole === "TECH"
      ? "Field Tech"
      : userRole === "ADMIN"
        ? "Admin"
        : userRole === "OWNER"
          ? "Owner"
          : userRole === "SALES_REP"
            ? "Sales Rep"
            : "Customer";

  const surfaceClasses = theme === "dark"
    ? "border-b border-white/10 bg-slate-950/95"
    : "border-b border-slate-200/70 bg-white/90";

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex items-center justify-between px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-opacity-80",
        surfaceClasses,
      )}
    >
      <div className="flex items-center gap-3">
        {showBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className={cn(
              "h-9 w-9",
              theme === "dark"
                ? "text-slate-400 hover:text-white"
                : "text-slate-500 hover:text-slate-900",
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "relative h-9 w-9 overflow-hidden rounded-xl border",
              theme === "dark"
                ? "border-white/10 bg-slate-900/80"
                : "border-slate-200/70 bg-white/85",
            )}
          >
            <Image
              src="/brand/insightscoop-logo-stacked.png"
              alt="InsightScoop"
              fill
              sizes="36px"
              className="object-contain p-1.5"
            />
          </div>
          <div>
            {title ? (
              <h1
                className={cn(
                  "text-lg font-semibold",
                  theme === "dark" ? "text-white" : "text-slate-900",
                )}
              >
                {title}
              </h1>
            ) : null}
            {session ? (
              <p
                className={cn(
                  "text-xs",
                  theme === "dark" ? "text-slate-400" : "text-slate-500",
                )}
              >
                {roleDisplay}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open settings"
            className={cn(
              "h-9 w-9",
              theme === "dark"
                ? "text-slate-300 hover:text-white"
                : "text-slate-500 hover:text-slate-900",
            )}
          >
            <Settings2 className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className={cn(
            "rounded-t-3xl border-t px-6 pb-10 pt-6 sm:max-w-md",
            theme === "dark"
              ? "border-white/10 bg-slate-950"
              : "border-slate-200/70 bg-slate-50",
          )}
        >
          <SheetHeader className="space-y-1 text-left">
            <SheetTitle className="text-base font-semibold">
              Settings &amp; status
            </SheetTitle>
            {session ? (
              <p className="text-xs text-muted-foreground">
                Signed in as {session.user?.name ?? session.user?.email}
              </p>
            ) : null}
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <ThemeToggle />

            <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-4 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white/70">
              <p className="font-semibold text-slate-900 dark:text-white">Role</p>
              <p className="mt-1 text-sm capitalize text-slate-600 dark:text-white/70">
                {roleDisplay.toLowerCase()}
              </p>
            </div>

            <Button
              onClick={handleLogout}
              size="lg"
              className={cn(
                "h-12 w-full gap-2 rounded-2xl text-sm font-semibold",
                theme === "dark"
                  ? "bg-white/5 text-white hover:bg-white/10"
                  : "bg-white text-slate-900 hover:bg-slate-100",
              )}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
