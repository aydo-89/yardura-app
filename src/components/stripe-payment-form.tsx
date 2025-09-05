'use client';

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CreditCard, Shield, Lock } from 'lucide-react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface StripePaymentFormProps {
  onPaymentMethodReady: (paymentMethodId: string, customerId: string) => void;
  amount: number;
  customerEmail: string;
  customerName: string;
  disabled?: boolean;
}

function PaymentForm({
  onPaymentMethodReady,
  amount,
  customerEmail,
  customerName,
  disabled,
}: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // First, create a setup intent to save the payment method
      const setupResponse = await fetch('/api/stripe/setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerEmail, customerName }),
      });

      if (!setupResponse.ok) {
        throw new Error('Failed to create setup intent');
      }

      const { clientSecret, customerId } = await setupResponse.json();

      // Confirm the setup intent to save the payment method
      const { error: setupError, setupIntent } = await stripe.confirmSetup({
        elements,
        clientSecret,
        redirect: 'if_required',
      });

      if (setupError) {
        setError(setupError.message || 'Payment method setup failed');
        return;
      }

      if (setupIntent.status === 'succeeded') {
        // Payment method is now saved, pass it back to parent
        const paymentMethodId = setupIntent.payment_method as string;
        onPaymentMethodReady(paymentMethodId, customerId);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Secure Payment Information
        </CardTitle>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4" />
          <Lock className="h-4 w-4" />
          <span>Payment details are encrypted and secure</span>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-sm text-muted-foreground mb-4">
            <strong>Amount to be charged:</strong> ${amount.toFixed(2)}
            <br />
            <span className="text-xs">
              Your card will be saved for future service charges. You'll only be charged after
              service completion.
            </span>
          </div>

          <PaymentElement />

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded border">{error}</div>
          )}

          <Button
            type="submit"
            disabled={!stripe || !elements || isLoading || disabled}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up payment...
              </>
            ) : (
              'Save Payment Method'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

interface StripePaymentFormWrapperProps
  extends Omit<StripePaymentFormProps, 'onPaymentMethodReady'> {
  onPaymentMethodReady: (paymentMethodId: string, customerId: string) => void;
}

export default function StripePaymentFormWrapper({
  onPaymentMethodReady,
  amount,
  customerEmail,
  customerName,
  disabled,
}: StripePaymentFormWrapperProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Create setup intent when component mounts
    const createSetupIntent = async () => {
      try {
        const response = await fetch('/api/stripe/setup-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerEmail, customerName }),
        });

        if (response.ok) {
          const { clientSecret } = await response.json();
          setClientSecret(clientSecret);
        }
      } catch (error) {
        console.error('Failed to create setup intent:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (customerEmail) {
      createSetupIntent();
    }
  }, [customerEmail, customerName]);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading payment form...</span>
        </CardContent>
      </Card>
    );
  }

  if (!clientSecret) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="text-red-600">
            Failed to load payment form. Please refresh and try again.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#22c55e', // Green to match brand
          },
        },
      }}
    >
      <PaymentForm
        onPaymentMethodReady={onPaymentMethodReady}
        amount={amount}
        customerEmail={customerEmail}
        customerName={customerName}
        disabled={disabled}
      />
    </Elements>
  );
}
