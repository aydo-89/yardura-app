// Shared types for dashboard components
export type User = {
  id: string;
  name?: string | null;
  email: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  zipCode?: string | null;
  stripeCustomerId?: string | null;
  orgId?: string | null;
};

export type Dog = {
  id: string;
  name: string;
  breed?: string | null;
  age?: number | null;
  weight?: number | null;
};

export type ServiceVisit = {
  id: string;
  scheduledDate: string; // ISO
  status: string;
  serviceType: string;
  yardSize: string;
};

export type DataReading = {
  id: string;
  timestamp: string; // ISO
  weight?: number | null;
  volume?: number | null;
  color?: string | null;
  consistency?: string | null;
};

export type DashboardClientProps = {
  user: User;
  dogs: Dog[];
  serviceVisits: ServiceVisit[];
  dataReadings: DataReading[];
};
