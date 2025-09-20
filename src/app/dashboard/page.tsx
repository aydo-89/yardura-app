import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { safeGetServerSession } from '@/lib/auth';
import Dashboard from '@/components/dashboard/Dashboard';
import UserLayout from '@/components/layout/UserLayout';
import {
  generateMockDashboardData,
  generateMockDashboardDataNormal,
} from '@/lib/mockDashboardData';

export default async function DashboardPage() {
  // Get authenticated user session
  const session = await safeGetServerSession({
    callbacks: {
      session: async ({ session, token }: any) => {
        if (token?.uid && typeof token.uid === 'string') {
          (session.user as any).id = token.uid;
        }

        // Get user role from database
        if (session?.user?.email) {
          try {
            const user = await prisma.user.findUnique({
              where: { email: session.user.email },
              select: { role: true, orgId: true },
            });

            if (user) {
              (session as any).userRole = user.role;
              (session.user as any).orgId = user.orgId;
            }
          } catch (error) {
            console.error('Error fetching user role:', error);
          }
        }

        return session;
      },
      jwt: async ({ user, token }: any) => {
        if (user && user.id) {
          (token as any).uid = String(user.id);
        }
        return token;
      },
    },
  });

  if (!session?.user?.email) {
    redirect('/signin?callbackUrl=/dashboard');
  }

  // Redirect admin users to admin dashboard
  const userRole = (session as any).userRole;
  if (userRole === 'ADMIN' || userRole === 'OWNER' || userRole === 'TECH') {
    redirect('/admin');
  }

  // DEVELOPMENT: Allow mock data in development for demo purposes
  const useMock = process.env.DASHBOARD_USE_MOCK === '1' && process.env.NODE_ENV === 'development' && false; // Disabled by default
  const mockProfile = process.env.DASHBOARD_MOCK_PROFILE || 'diverse'; // 'diverse' | 'normal'
  let user;

  if (useMock) {
    // Use mock data for development demo
    const mockData =
      mockProfile === 'normal' ? generateMockDashboardDataNormal() : generateMockDashboardData();
    user = mockData.user;
  } else {
    try {
      // Load real user data from database
      user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
          dogs: true,
          serviceVisits: {
            orderBy: { scheduledDate: 'desc' },
            take: 20,
          },
          dataReadings: {
            orderBy: { timestamp: 'desc' },
            take: 100,
          },
        },
      });

      if (!user) {
        // User not found in database, redirect to signin
        redirect('/signin?callbackUrl=/dashboard');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      redirect('/signin?callbackUrl=/dashboard');
    }
  }

  // Prepare serializable props for client component
  type DogRecord = {
    id: string;
    name: string;
    breed: string | null;
    age: number | null;
    weight: number | null;
  };
  type ServiceVisitRecord = {
    id: string;
    scheduledDate: Date;
    status: string;
    serviceType: string;
    yardSize: string;
  };
  type DataReadingRecord = {
    id: string;
    timestamp: Date;
    weight: number | null;
    volume: number | null;
    color: string | null;
    consistency: string | null;
  };

  let clientUser,
    clientDogs,
    clientServiceVisits,
    clientDataReadings: Array<{
      id: string;
      timestamp: string;
      weight?: number | null;
      volume?: number | null;
      color?: string | null;
      consistency?: string | null;
    }>;

  if (useMock) {
    // Use new mock data system instead of old hardcoded data
    const mockData =
      mockProfile === 'normal' ? generateMockDashboardDataNormal() : generateMockDashboardData();
    clientUser = mockData.user;
    clientDogs = mockData.dogs;
    clientServiceVisits = mockData.serviceVisits;

    // For brand new user experience, use empty data to show empty states
    // To see brand new user dashboard (no data yet):
    // 1. Comment out the line below
    // 2. Uncomment the line after it
    clientDataReadings = mockData.dataReadings; // Full mock data - shows complete dashboard
    // clientDataReadings = []; // Empty array - shows brand new user experience
  } else {
    if (!user) {
      // This should never happen since we redirect if user is not found
      throw new Error('User not found');
    }

    clientUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
      city: user.city,
      zipCode: user.zipCode,
      stripeCustomerId: user.stripeCustomerId,
      orgId: user.orgId || null,
    } as const;

    clientDogs = (user as any).dogs?.map((d: DogRecord) => ({
      id: d.id,
      name: d.name,
      breed: d.breed,
      age: d.age,
      weight: d.weight,
    })) || [];

    clientServiceVisits = (user as any).serviceVisits?.map((v: ServiceVisitRecord) => ({
      id: v.id,
      scheduledDate: v.scheduledDate.toISOString(),
      status: v.status,
      serviceType: v.serviceType,
      yardSize: v.yardSize,
    })) || [];

    clientDataReadings = (user as any).dataReadings?.map((r: DataReadingRecord) => ({
      id: r.id,
      timestamp: r.timestamp.toISOString(),
      weight: r.weight,
      volume: r.volume,
      color: r.color,
      consistency: r.consistency,
    })) || [];
  }

  return (
    <UserLayout>
      <div className="container py-8 pt-20">
        <Dashboard
          user={clientUser}
          dogs={clientDogs}
          serviceVisits={clientServiceVisits}
          dataReadings={clientDataReadings}
        />
      </div>
    </UserLayout>
  );
}

