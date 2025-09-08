// DEVELOPMENT: Always use test user data for demo
// TODO: Restore proper authentication for production
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Dashboard from '@/components/dashboard/Dashboard';
import { generateMockDashboardData, generateMockDashboardDataNormal } from '@/lib/mockDashboardData';

export default async function DashboardPage() {
  // DEVELOPMENT: Always use test user data for demo
  // TODO: Restore proper authentication for production
  const useMock = process.env.DASHBOARD_USE_MOCK === '1';
  const mockProfile = process.env.DASHBOARD_MOCK_PROFILE || 'diverse'; // 'diverse' | 'normal'
  let user;

  if (!useMock) {
    try {
      user = await prisma.user.findUnique({
        where: { email: 'test@example.com' },
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
        // Create test user if it doesn't exist
        user = await prisma.user.create({
          data: {
            email: 'test@example.com',
            name: 'Test User',
          },
          include: {
            dogs: true,
            serviceVisits: true,
            dataReadings: true,
          },
        });
      }
    } catch (error) {
      console.error('Error loading test user:', error);
      // Fallback: redirect to signin
      redirect('/signin');
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

  let clientUser, clientDogs, clientServiceVisits, clientDataReadings: Array<{
    id: string;
    timestamp: string;
    weight?: number | null;
    volume?: number | null;
    color?: string | null;
    consistency?: string | null;
  }>;

  if (useMock) {
    // Use new mock data system instead of old hardcoded data
    const mockData = mockProfile === 'normal' ? generateMockDashboardDataNormal() : generateMockDashboardData();
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

    clientDogs = user.dogs.map((d: DogRecord) => ({
      id: d.id,
      name: d.name,
      breed: d.breed,
      age: d.age,
      weight: d.weight,
    }));

    clientServiceVisits = user.serviceVisits.map((v: ServiceVisitRecord) => ({
      id: v.id,
      scheduledDate: v.scheduledDate.toISOString(),
      status: v.status,
      serviceType: v.serviceType,
      yardSize: v.yardSize,
    }));

    clientDataReadings = user.dataReadings.map((r: DataReadingRecord) => ({
      id: r.id,
      timestamp: r.timestamp.toISOString(),
      weight: r.weight,
      volume: r.volume,
      color: r.color,
      consistency: r.consistency,
    }));
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      <div className="container py-8">
        {process.env.NODE_ENV !== 'production' && (
          <div className="mb-4 text-xs text-slate-600 flex items-center gap-3">
            <span>Data source:</span>
            <span className={useMock ? 'px-2 py-1 rounded bg-amber-100 text-amber-800' : 'px-2 py-1 rounded bg-emerald-100 text-emerald-800'}>
              {useMock ? 'Mock' : 'Live'}
            </span>
            <span className="ml-2">
              Toggle by setting <code className="px-1 rounded bg-slate-100">DASHBOARD_USE_MOCK={useMock ? '0' : '1'}</code>, profile via <code className="px-1 rounded bg-slate-100">DASHBOARD_MOCK_PROFILE=normal|diverse</code>, then refresh
            </span>
          </div>
        )}
        <Dashboard
          user={clientUser}
          dogs={clientDogs}
          serviceVisits={clientServiceVisits}
          dataReadings={clientDataReadings}
        />
      </div>
    </div>
  );
}
