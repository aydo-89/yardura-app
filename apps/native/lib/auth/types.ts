export type AppUserRole = 'CUSTOMER' | 'SALES_REP' | 'TECH' | 'ADMIN' | 'OWNER';

export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  orgId?: string | null;
  customerId?: string | null;
  scooperProfileId?: string | null;
  imageUrl?: string | null;
  address?: string | null;
  city?: string | null;
  zipCode?: string | null;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
  roles: AppUserRole[];
  activeRole: AppUserRole | null;
};

export type AuthLoginResponse = {
  token: string;
  user: AuthUser;
  roles: AppUserRole[];
  activeRole: AppUserRole | null;
};
