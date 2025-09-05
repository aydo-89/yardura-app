"use client";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function BillingPage() {
  const [loading, setLoading] = useState(false);
  const onOpenPortal = async () => {
    try {
      setLoading(true);
      // TODO: fetch actual Stripe customer ID for the logged in user
      const res = await fetch('/api/billing/portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: 'replace_me', returnUrl: window.location.origin + '/billing' })
      });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="container py-8">
      <Card>
        <CardHeader><CardTitle>Billing</CardTitle></CardHeader>
        <CardContent>
          <Button onClick={onOpenPortal} disabled={loading}>Open Customer Portal</Button>
        </CardContent>
      </Card>
    </div>
  );
}

