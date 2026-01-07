import { DefaultSession } from "next-auth";
import type { AppUserRole } from "@/lib/auth/roles";

declare module "next-auth" {
  interface Session {
    activeRole?: AppUserRole | null;
    userRoles?: AppUserRole[];
    user: DefaultSession["user"] & {
      id?: string;
      role?: AppUserRole | null;
      orgId?: string | null;
      roles?: AppUserRole[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    activeRole?: AppUserRole | null;
  }
}
