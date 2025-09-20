'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { signIn } from 'next-auth/react';

function VerifyMagicLinkContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  const token = searchParams.get('token');
  const email = searchParams.get('email');
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  useEffect(() => {
    if (!token || !email) {
      setStatus('error');
      setErrorMessage('Invalid magic link');
      return;
    }

    verifyMagicLink();
  }, [token, email]);

  const verifyMagicLink = async () => {
    try {
      // Verify the token with NextAuth
      const result = await signIn('email', {
        email,
        token,
        redirect: false,
        callbackUrl,
      });

      if (result?.ok) {
        setStatus('success');
        // Redirect after a short delay to show success message
        setTimeout(() => {
          router.push(callbackUrl);
        }, 2000);
      } else {
        setStatus('error');
        setErrorMessage('Invalid or expired magic link');
      }
    } catch (error) {
      console.error('Magic link verification error:', error);
      setStatus('error');
      setErrorMessage('Failed to verify magic link');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/5 to-accent-soft/10 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Verifying Magic Link</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            {status === 'verifying' && (
              <div className="space-y-4">
                <Loader2 className="w-12 h-12 animate-spin text-accent mx-auto" />
                <p className="text-gray-600">Verifying your magic link...</p>
              </div>
            )}

            {status === 'success' && (
              <div className="space-y-4">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold text-green-800 mb-2">Success!</h3>
                  <p className="text-gray-600 mb-4">
                    Your account has been verified. Redirecting you to complete setup...
                  </p>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold text-red-800 mb-2">Verification Failed</h3>
                  <p className="text-gray-600 mb-4">
                    {errorMessage || 'This magic link is invalid or has expired.'}
                  </p>
                  <div className="space-y-2">
                    <Button onClick={() => router.push('/signin')} className="w-full">
                      Try Signing In Again
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => router.push('/quote?businessId=yardura')}
                      className="w-full"
                    >
                      Start New Quote
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function VerifyMagicLinkPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-accent/5 to-accent-soft/10 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Loading...</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-accent mx-auto" />
              <p className="text-gray-600 mt-4">Loading verification page...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    }>
      <VerifyMagicLinkContent />
    </Suspense>
  );
}

