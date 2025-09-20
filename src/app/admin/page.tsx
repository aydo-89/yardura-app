"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Settings,
  MapPin,
  DollarSign,
  BarChart3,
  Users,
  Building,
  Sparkles,
  Shield,
  FileText,
} from "lucide-react";

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return; // Still loading

    const userRole = (session as any)?.userRole;
    const isAdmin =
      userRole === "ADMIN" ||
      userRole === "OWNER" ||
      userRole === "TECH" ||
      userRole === "SALES_REP";

    if (!session || !isAdmin) {
      router.push("/dashboard");
      return;
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }
  const isGodModeUser = session?.user?.email === "ayden@yardura.com";

  const adminTools = [
    {
      title: "Lead Management",
      description: "View and manage customer leads from quote submissions",
      icon: FileText,
      href: "/admin/leads",
      color: "text-green-600",
    },
    {
      title: "Outbound Pipeline",
      description: "Track canvassing territories, cadences, and Trips",
      icon: Sparkles,
      href: "/admin/leads/outbound",
      color: "text-cyan-600",
    },
    {
      title: "Trips & Routes",
      description: "Plan canvassing loops and review saved trip logs",
      icon: MapPin,
      href: "/admin/leads/trips",
      color: "text-emerald-600",
    },
    {
      title: "Pricing Management",
      description: "Configure pricing tiers, frequencies, and zone multipliers",
      icon: DollarSign,
      href: "/admin/pricing",
      color: "text-purple-600",
    },
    {
      title: "ZIP Code Management",
      description: "Search for ZIP codes by city and manage service areas",
      icon: MapPin,
      href: "/admin/zip-search",
      color: "text-green-600",
    },
    {
      title: "Analytics Dashboard",
      description: "View business analytics and performance metrics",
      icon: BarChart3,
      href: "/admin/analytics",
      color: "text-red-600",
    },
    {
      title: "User Management",
      description: "Create accounts for new business partners",
      icon: Users,
      href: "/admin/users",
      color: "text-indigo-600",
    },
    // God Mode - only for owner
    ...(isGodModeUser
      ? [
          {
            title: "God Mode",
            description: "Ultimate system control - Owner access only",
            icon: Shield,
            href: "/admin/god-mode",
            color: "text-yellow-600",
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/20">
      <div className="container mx-auto p-6 pt-20">
        {/* Enhanced header with modern styling */}
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-brand-600 to-brand-700 rounded-3xl shadow-xl">
              <Settings className="size-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                Yardura Service OS
              </h1>
              <p className="text-lg text-slate-600 font-medium">
                Business Operations & Management Platform
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Separate from customer-facing services • Admin access required
              </p>
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-green-800">
                System Online
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm font-medium text-blue-800">
                All Services Active
              </span>
            </div>
          </div>
        </div>

        {/* Enhanced admin tools grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 mb-12">
          {adminTools.map((tool, index) => (
            <Card
              key={tool.href}
              className="group relative overflow-hidden bg-white/80 backdrop-blur-sm border border-slate-200/60 hover:border-brand-300/60 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] rounded-3xl"
            >
              {/* Gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-brand-50/0 to-brand-100/0 group-hover:from-brand-50/50 group-hover:to-brand-100/30 transition-all duration-300"></div>

              <CardHeader className="relative z-10">
                <CardTitle className="flex items-center gap-4">
                  <div
                    className={`p-4 rounded-2xl shadow-lg transition-all duration-300 group-hover:scale-110 ${
                      index % 6 === 0
                        ? "bg-gradient-to-br from-blue-100 to-blue-200 text-blue-600"
                        : index % 6 === 1
                          ? "bg-gradient-to-br from-green-100 to-green-200 text-green-600"
                          : index % 6 === 2
                            ? "bg-gradient-to-br from-purple-100 to-purple-200 text-purple-600"
                            : index % 6 === 3
                              ? "bg-gradient-to-br from-orange-100 to-orange-200 text-orange-600"
                              : index % 6 === 4
                                ? "bg-gradient-to-br from-red-100 to-red-200 text-red-600"
                                : "bg-gradient-to-br from-indigo-100 to-indigo-200 text-indigo-600"
                    }`}
                  >
                    <tool.icon className="h-7 w-7" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-slate-900">
                      {tool.title}
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                <p className="text-slate-600 mb-6 leading-relaxed">
                  {tool.description}
                </p>
                <Link href={tool.href}>
                  <Button className="w-full bg-gradient-to-r from-slate-900 to-slate-800 hover:from-brand-600 hover:to-brand-700 text-white font-semibold py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                    Access Tool
                    <span className="ml-2">→</span>
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Enhanced Quick Actions section */}
        <div className="bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-3xl p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-brand-100 to-brand-200 rounded-2xl">
              <Sparkles className="size-6 text-brand-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Quick Actions
              </h2>
              <p className="text-slate-600">Common tasks and shortcuts</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/admin/zip-search">
              <Button
                variant="outline"
                className="w-full justify-start gap-3 p-4 h-auto rounded-2xl border-2 hover:border-brand-300 hover:bg-brand-50 transition-all duration-200 group"
              >
                <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-xl group-hover:bg-green-200 transition-colors duration-200">
                  <MapPin className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-slate-900">
                    Add ZIP Codes
                  </div>
                  <div className="text-xs text-slate-500">
                    Expand service areas
                  </div>
                </div>
              </Button>
            </Link>

            <Link href="/admin/pricing">
              <Button
                variant="outline"
                className="w-full justify-start gap-3 p-4 h-auto rounded-2xl border-2 hover:border-brand-300 hover:bg-brand-50 transition-all duration-200 group"
              >
                <div className="flex items-center justify-center w-10 h-10 bg-purple-100 rounded-xl group-hover:bg-purple-200 transition-colors duration-200">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-slate-900">
                    Update Pricing
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Adjust rates & tiers
                  </div>
                </div>
              </Button>
            </Link>

            <Link href="/admin/zip-search">
              <Button
                variant="outline"
                className="w-full justify-start gap-3 p-4 h-auto rounded-2xl border-2 hover:border-brand-300 hover:bg-brand-50 transition-all duration-200 group"
              >
                <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-xl group-hover:bg-green-200 transition-colors duration-200">
                  <MapPin className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-slate-900">
                    Manage ZIP Codes
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Add/remove service areas
                  </div>
                </div>
              </Button>
            </Link>
          </div>
        </div>

        {/* Enhanced System Status */}
        <div className="bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-3xl p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-2xl">
              <Shield className="size-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                System Status
              </h2>
              <p className="text-slate-600">All systems operational</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 bg-white/80 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="font-medium text-slate-900">
                  Business Configuration
                </span>
              </div>
              <span className="text-green-600 font-bold">Active</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/80 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="font-medium text-slate-900">
                  ZIP Eligibility System
                </span>
              </div>
              <span className="text-green-600 font-bold">Active</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/80 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="font-medium text-slate-900">
                  Pricing Engine
                </span>
              </div>
              <span className="text-green-600 font-bold">Active</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/80 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="font-medium text-slate-900">
                  Multi-tenant Support
                </span>
              </div>
              <span className="text-blue-600 font-bold">Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
