"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard } from "lucide-react";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

interface AddCardFormInnerProps {
  clientSecret: string;
  onSuccess: (paymentMethodId: string) => void;
  onCancel: () => void;
  disabled?: boolean;
}

function AddCardFormInner({
  clientSecret,
  onSuccess,
  onCancel,
  disabled,
}: AddCardFormInnerProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    try {
      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        clientSecret,
        redirect: "if_required",
      });

      if (confirmError) {
        setError(confirmError.message || "We couldn’t save that card.");
        return;
      }

      if (setupIntent && setupIntent.status === "succeeded") {
        const paymentMethodId = setupIntent.payment_method as string | null;
        if (paymentMethodId) {
          onSuccess(paymentMethodId);
        } else {
          setError("Stripe did not return a payment method ID.");
        }
      } else {
        setError("We were unable to confirm the card. Try again in a moment.");
      }
    } catch (submissionError: any) {
      setError(submissionError?.message || "Something went wrong while saving your card.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: {
            type: "tabs",
          },
        }}
      />
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={submitting || disabled}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="gap-2"
          disabled={!stripe || !elements || submitting || disabled}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving card…
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4" />
              Save card
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

interface AddCardFormProps {
  onSuccess: (paymentMethodId: string) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export default function AddCardForm({
  onSuccess,
  onCancel,
  disabled,
}: AddCardFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/billing/setup-intent", {
          method: "POST",
        });
        const json = await response.json();
        if (!response.ok || !json?.clientSecret) {
          throw new Error(json?.error || "Failed to initialise Stripe");
        }
        if (mounted) {
          setClientSecret(json.clientSecret as string);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || "Unable to start card setup right now.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void init();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center px-4 py-6 text-sm text-[rgba(var(--graphite-rgb-commas),0.7)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing secure form…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!clientSecret || !stripePromise) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-4 text-sm text-red-700">
        Stripe configuration missing.
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#19B4A3",
          },
        },
      }}
    >
      <AddCardFormInner
        clientSecret={clientSecret}
        onSuccess={onSuccess}
        onCancel={onCancel}
        disabled={disabled}
      />
    </Elements>
  );
}
