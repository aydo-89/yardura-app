'use client';

import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AddressAutocomplete from '@/components/AddressAutocomplete';

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/users', { cache: 'no-store' });
        if (res.ok) {
          const { user } = await res.json();
          setName(user?.name || '');
          setPhone(user?.phone || '');
          setAddress(user?.address || '');
          setCity(user?.city || '');
          setZipCode(user?.zipCode || '');
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, city, zipCode, phone }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white py-8">
      <div className="container max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Account Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="text-slate-600">Loading…</div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Full Name</label>
                  <Input value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} disabled />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <Input value={phone} onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Address</label>
                  <AddressAutocomplete
                    value={address}
                    onChange={(val: string) => setAddress(val)}
                    onSelect={(addr: { formattedAddress: string; city?: string; postalCode?: string }) => {
                      if (addr.formattedAddress) setAddress(addr.formattedAddress);
                      if (addr.city) setCity(addr.city || '');
                      if (addr.postalCode) setZipCode(addr.postalCode || '');
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">City</label>
                    <Input value={city} onChange={(e: ChangeEvent<HTMLInputElement>) => setCity(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">ZIP Code</label>
                    <Input value={zipCode} onChange={(e: ChangeEvent<HTMLInputElement>) => setZipCode(e.target.value)} />
                  </div>
                </div>
                <div className="pt-2">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
