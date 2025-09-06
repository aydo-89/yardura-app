import { safeGetServerSession } from '@/lib/auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import DashboardClientNew from '@/components/DashboardClientNew';
import { generateMockDashboardData } from '@/lib/mockDashboardData';

export default async function DashboardPage() {
  const url = new URL(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost'}/dummy`);
  // Next doesn't give us request here; use env toggle instead
  const useMock = process.env.DASHBOARD_USE_MOCK === '1';
  const session = (await safeGetServerSession(authOptions as any)) as {
    user?: { id?: string; email?: string };
  } | null;

  const userId = session?.user?.id;
  if (!userId && !useMock) {
    redirect('/signin');
  }

  const user = useMock ? null : await prisma.user.findUnique({
    where: { id: userId },
    include: {
      dogs: true,
      serviceVisits: {
        orderBy: { scheduledDate: 'desc' },
        take: 5,
      },
      dataReadings: {
        orderBy: { timestamp: 'desc' },
        take: 20,
      },
    },
  });

  if (!user && !useMock) {
    redirect('/signin');
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

  const mock = useMock ? generateMockDashboardData() : null;
  const clientUser = useMock
    ? mock!.user
    : ({
        id: user!.id,
        name: user!.name,
        email: user!.email,
        phone: user!.phone,
        address: user!.address,
        city: user!.city,
        zipCode: user!.zipCode,
        stripeCustomerId: user!.stripeCustomerId,
        orgId: user!.orgId || null,
      } as const);

  const clientDogs = useMock ? mock!.dogs : user!.dogs.map((d: DogRecord) => ({
    id: d.id,
    name: d.name,
    breed: d.breed,
    age: d.age,
    weight: d.weight,
  }));

  const clientServiceVisits = useMock ? mock!.serviceVisits : user!.serviceVisits.map((v: ServiceVisitRecord) => ({
    id: v.id,
    scheduledDate: v.scheduledDate.toISOString(),
    status: v.status,
    serviceType: v.serviceType,
    yardSize: v.yardSize,
  }));

  const clientDataReadings = useMock ? mock!.dataReadings : user!.dataReadings.map((r: DataReadingRecord) => ({
    id: r.id,
    timestamp: r.timestamp.toISOString(),
    weight: r.weight,
    volume: r.volume,
    color: r.color,
    consistency: r.consistency,
  }));

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
              Toggle by setting <code className="px-1 rounded bg-slate-100">DASHBOARD_USE_MOCK={useMock ? '0' : '1'}</code> and refreshing
            </span>
          </div>
        )}
        <DashboardClientNew
          user={clientUser}
          dogs={clientDogs}
          serviceVisits={clientServiceVisits}
          dataReadings={clientDataReadings}
        />
      </div>
    </div>
  );
}
