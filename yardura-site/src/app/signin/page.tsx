import { Metadata } from 'next';
import { Suspense } from 'react';
import SignInForm from '@/components/auth/SignInForm';

import { getProviders } from 'next-auth/react';

export const metadata: Metadata = {
  title: 'Sign in • Yardura',
  robots: { index: false, follow: false },
};

function SignInFormWrapper() {
  return <SignInForm />;
}

export default async function SignInPage() {
  const providers = await getProviders();
  return (
    <section className="container py-16">
      <div className="max-w-md mx-auto rounded-2xl border border-brand-200 bg-white p-8 shadow-soft">
        <h1 className="text-2xl font-extrabold text-ink mb-2">Sign in</h1>
        <p className="text-slate-600 text-sm mb-6">
          Use your email, Google, or password to continue.
        </p>

        {/* OAuth Providers */}
        <div className="grid gap-3 mb-6">
          {providers &&
            Object.values(providers)
              .filter((p: any) => p.id !== 'credentials') // Exclude credentials from OAuth list
              .map((p: any) => (
                <a
                  key={p.id}
                  href={`/api/auth/signin/${p.id}`}
                  className="w-full px-4 py-3 rounded-xl border border-brand-300 hover:bg-brand-50 font-semibold text-center block"
                >
                  Continue with {p.name}
                </a>
              ))}
        </div>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or continue with email</span>
          </div>
        </div>

        {/* Password Sign In Form */}
        <Suspense fallback={<div>Loading...</div>}>
          <SignInFormWrapper />
        </Suspense>

        <p className="text-xs text-slate-500 mt-6">
          Protected by Google re-evaluation and served over HTTPS.
        </p>
      </div>
    </section>
  );
}
