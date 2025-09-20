import { redirect } from 'next/navigation';
import { safeGetServerSession } from '@/lib/auth';
import AccountPageClient from '@/components/account/AccountPageClient';
import UserLayout from '@/components/layout/UserLayout';

export default async function AccountPage() {
  // Check authentication on server side
  const session = await safeGetServerSession({
    callbacks: {
      session: async ({ session, token }: any) => {
        if (token?.uid && typeof token.uid === 'string') {
          (session.user as any).id = token.uid;
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
    redirect('/signin?callbackUrl=/account');
  }

  // Return client component wrapped in user layout
  return (
    <UserLayout>
      <div className="container py-8 pt-20">
        <AccountPageClient userEmail={session.user.email} />
      </div>
    </UserLayout>
  );
}
