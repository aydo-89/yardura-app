import { safeGetServerSession } from '@/lib/auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import DashboardClientNew from '@/components/DashboardClientNew';

export default async function DashboardPage() {
  const session = (await safeGetServerSession(authOptions as any)) as {
    user?: { id?: string; email?: string };
  } | null;

  const userId = session?.user?.id;
  if (!userId) {
    redirect('/signin');
  }

  const user = await prisma.user.findUnique({
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

  if (!user) {
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

  const clientUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    address: user.address,
    city: user.city,
    zipCode: user.zipCode,
  } as const;

  const clientDogs = user.dogs.map((d: DogRecord) => ({
    id: d.id,
    name: d.name,
    breed: d.breed,
    age: d.age,
    weight: d.weight,
  }));

  const clientServiceVisits = user.serviceVisits.map((v: ServiceVisitRecord) => ({
    id: v.id,
    scheduledDate: v.scheduledDate.toISOString(),
    status: v.status,
    serviceType: v.serviceType,
    yardSize: v.yardSize,
  }));

  const clientDataReadings = user.dataReadings.map((r: DataReadingRecord) => ({
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
