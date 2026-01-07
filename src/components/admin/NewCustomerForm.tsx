'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface FormState {
  name: string;
  email: string;
  phone: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
  latitude: string;
  longitude: string;
}

const initialForm: FormState = {
  name: '',
  email: '',
  phone: '',
  addressLine1: '',
  city: '',
  state: '',
  zip: '',
  notes: '',
  latitude: '',
  longitude: '',
};

export function NewCustomerForm() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const handleChange = (field: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      addressLine1: form.addressLine1.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      zip: form.zip.trim(),
    };

    if (!payload.name || !payload.addressLine1 || !payload.city || !payload.state || !payload.zip) {
      toast.error('Please complete the required fields.');
      return;
    }

    if (form.email.trim()) {
      payload.email = form.email.trim();
    }
    if (form.phone.trim()) {
      payload.phone = form.phone.trim();
    }
    if (form.notes.trim()) {
      payload.notes = form.notes.trim();
    }

    if (form.latitude.trim()) {
      const latNumber = Number.parseFloat(form.latitude.trim());
      if (Number.isFinite(latNumber)) {
        payload.latitude = latNumber;
      } else {
        toast.error('Latitude must be a valid number.');
        return;
      }
    }

    if (form.longitude.trim()) {
      const longNumber = Number.parseFloat(form.longitude.trim());
      if (Number.isFinite(longNumber)) {
        payload.longitude = longNumber;
      } else {
        toast.error('Longitude must be a valid number.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        const message = data?.error === 'validation_failed'
          ? 'Please double-check the provided details.'
          : data?.error || 'Failed to create customer record.';
        toast.error(message);
        return;
      }

      toast.success('Customer created');
      setForm(initialForm);
      if (data.customer?.id) {
        router.push(`/admin/customers/${data.customer.id}`);
        router.refresh();
      }
    } catch (error) {
      console.error(error);
      toast.error('Unexpected error creating customer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="max-w-3xl border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle>Create customer profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="name">Full name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={handleChange('name')}
                placeholder="Jane Doe"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={handleChange('email')}
                placeholder="jane@example.com"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={handleChange('phone')}
                placeholder="(555) 555-5555"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="address">Street address *</Label>
              <Input
                id="address"
                value={form.addressLine1}
                onChange={handleChange('addressLine1')}
                placeholder="123 Main St"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                value={form.city}
                onChange={handleChange('city')}
                placeholder="Minneapolis"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="state">State *</Label>
              <Input
                id="state"
                value={form.state}
                onChange={handleChange('state')}
                placeholder="MN"
                required
                maxLength={32}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="zip">ZIP *</Label>
              <Input
                id="zip"
                value={form.zip}
                onChange={handleChange('zip')}
                placeholder="55401"
                required
                maxLength={16}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                value={form.latitude}
                onChange={handleChange('latitude')}
                placeholder="44.9778"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                value={form.longitude}
                onChange={handleChange('longitude')}
                placeholder="-93.2650"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">Internal notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={handleChange('notes')}
              placeholder="Gate code, pet instructions, special requests..."
              rows={4}
            />
            <p className="text-xs text-slate-500">
              Visible to managers and techs inside the portal. Customers do not see these notes.
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create customer
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
