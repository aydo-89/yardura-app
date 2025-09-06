'use client';

import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';

export default function NewDogPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/dogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          breed: breed || null,
          age: age ? parseInt(age) : null,
          weight,
        }),
      });
      if (res.ok) {
        router.push('/dashboard');
      } else {
        setSaving(false);
      }
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white py-8">
      <div className="container max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Add a Dog</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <Input value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Breed</label>
              <Input value={breed} onChange={(e: ChangeEvent<HTMLInputElement>) => setBreed(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Age (years)</label>
                <Input value={age} onChange={(e: ChangeEvent<HTMLInputElement>) => setAge(e.target.value)} type="number" min="0" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Weight (lbs)</label>
                <Input value={weight} onChange={(e: ChangeEvent<HTMLInputElement>) => setWeight(e.target.value)} type="number" min="0" />
              </div>
            </div>
            <div className="pt-2">
              <Button onClick={handleSave} disabled={saving || !name.trim()}>
                {saving ? 'Saving…' : 'Save Dog'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
