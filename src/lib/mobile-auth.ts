import jwt from 'jsonwebtoken';

import { env } from '@/lib/env';
import type { AppUserRole } from '@/lib/auth/roles';

export type MobileAuthPayload = {
  sub: string;
  email: string;
  roles: AppUserRole[];
  activeRole: AppUserRole | null;
  orgId?: string | null;
};

const JWT_SECRET = env.NEXTAUTH_SECRET ?? 'development-secret-key';
const TOKEN_TTL = '30d';

export function signMobileToken(payload: MobileAuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyMobileToken(token: string): MobileAuthPayload {
  return jwt.verify(token, JWT_SECRET) as MobileAuthPayload;
}
