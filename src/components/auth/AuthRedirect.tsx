'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, LogIn } from 'lucide-react';

interface AuthRedirectProps {
  title?: string;
  message?: string;
  showLoginButton?: boolean;
}

export default function AuthRedirect({
  title = "Authentication Required",
  message = "You need to sign in to access this page.",
  showLoginButton = true,
}: AuthRedirectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  useEffect(() => {
    // Auto-redirect after a short delay
    const timer = setTimeout(() => {
      if (!showLoginButton) {
        router.push('/signin?callbackUrl=' + encodeURIComponent(callbackUrl));
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [router, callbackUrl, showLoginButton]);

  const handleSignIn = () => {
    router.push('/signin?callbackUrl=' + encodeURIComponent(callbackUrl));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            {message}
          </p>

          {showLoginButton && (
            <div className="space-y-3">
              <Button onClick={handleSignIn} className="w-full">
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </Button>
              <p className="text-xs text-muted-foreground">
                Redirecting to sign in page in 3 seconds...
              </p>
            </div>
          )}

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{' '}
              <button
                onClick={() => router.push('/signup')}
                className="text-brand-600 hover:text-brand-700 font-medium"
              >
                Sign up here
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


