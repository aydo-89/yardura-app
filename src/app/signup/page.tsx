"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Dog {
  id: string;
  name: string;
  breed: string;
  age: string;
  weight: string;
}

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPaymentSetup, setShowPaymentSetup] = useState(false);
  const [quoteData, setQuoteData] = useState<any>(null);

  // Load quote data if coming from quote form
  useEffect(() => {
    const savedQuoteData = localStorage.getItem('quoteFormData');
    const savedQuoteEstimate = localStorage.getItem('quoteEstimate');

    if (savedQuoteData) {
      const parsed = JSON.parse(savedQuoteData);
      setQuoteData({ ...parsed, estimate: savedQuoteEstimate });

      // Pre-populate form with quote data
      setName(parsed.name || '');
      setEmail(parsed.email || '');
      setPhone(parsed.phone || '');
      setAddress(parsed.address || '');
      setCity(parsed.city || 'Minneapolis');
      setZipCode(parsed.zipCode || '');
      setYardSize(parsed.yardSize || 'medium');
      setFrequency(parsed.frequency || 'weekly');
      setPreferredDay(parsed.preferredDay || 'Tuesday');
      setPreferredTime(parsed.preferredTime || 'Morning');

      // Set dogs from quote
      if (parsed.dogs) {
        setDogs(Array(parsed.dogs).fill(null).map((_, i) => ({
          id: Date.now().toString() + i,
          name: `Dog ${i + 1}`,
          breed: '',
          age: '',
          weight: ''
        })));
      }
    }
  }, []);

  // User info
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Minneapolis');
  const [zipCode, setZipCode] = useState('');

  // Property & scheduling
  const [yardSize, setYardSize] = useState('medium');
  const [daysSinceLastClean, setDaysSinceLastClean] = useState('');
  const [serviceType, setServiceType] = useState<'subscription' | 'one-time'>('subscription');
  const [frequency, setFrequency] = useState<'weekly' | 'twice-weekly' | 'bi-weekly' | 'one-time'>('weekly');
  const [preferredDay, setPreferredDay] = useState('Tuesday');
  const [preferredTime, setPreferredTime] = useState('Morning');

  // Dogs
  const [dogs, setDogs] = useState<Dog[]>([
    { id: '1', name: '', breed: '', age: '', weight: '' }
  ]);

  const addDog = () => {
    if (dogs.length < 8) {
      setDogs([...dogs, {
        id: Date.now().toString(),
        name: '',
        breed: '',
        age: '',
        weight: ''
      }]);
    }
  };

  const removeDog = (id: string) => {
    if (dogs.length > 1) {
      setDogs(dogs.filter(dog => dog.id !== id));
    }
  };

  const updateDog = (id: string, field: keyof Dog, value: string) => {
    setDogs(dogs.map(dog =>
      dog.id === id ? { ...dog, [field]: value } : dog
    ));
  };

  const handleSignUp = async () => {
    setLoading(true);

    // Validate passwords
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }

    try {
      // First, create the user account using our custom API
      const createAccountResponse = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          name,
          phone,
          address,
          city,
          zipCode,
          yardSize,
          daysSinceLastClean: parseInt(daysSinceLastClean || '0'),
          dogs: dogs.filter(d => d.name.trim()).map(dog => ({
            name: dog.name,
            breed: dog.breed || null,
            age: dog.age ? parseInt(dog.age) : null,
            weight: dog.weight ? parseFloat(dog.weight) : null,
          })),
          servicePreferences: {
            serviceType,
            frequency,
            preferredDay,
            preferredTime
          }
        })
      });

      if (!createAccountResponse.ok) {
        const errorData = await createAccountResponse.json();
        toast.error(errorData.error || 'Error creating account');
        return;
      }

      const result = await createAccountResponse.json();

      // Clear quote data from localStorage since account is created
      localStorage.removeItem('quoteFormData');
      localStorage.removeItem('quoteEstimate');

      // For now, redirect to sign in with success message
      // In the future, we can redirect to a payment setup page
      toast.success('Account created successfully! Your service is being set up.');
      router.push('/signin?message=account-created');
    } catch (error) {
      toast.error('Error creating account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white py-12">
      <div className="container max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-ink mb-4">Create Your Yardura Account</h1>
          <p className="text-slate-600">Join thousands of dog owners getting better insights and cleaner yards</p>
          {quoteData && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-50 border border-brand-200 rounded-lg">
              <span className="text-sm text-brand-700">Quote: ${quoteData.estimate} per visit</span>
            </div>
          )}
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="address">Address *</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="zipCode">ZIP Code *</Label>
                  <Input
                    id="zipCode"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="yardSize">Yard Size</Label>
                <select
                  id="yardSize"
                  value={yardSize}
                  onChange={(e) => setYardSize(e.target.value)}
                  className="w-full border border-brand-300 rounded-xl p-3"
                >
                  <option value="small">Small (&lt; 1/4 acre)</option>
                  <option value="medium">Medium (1/4 - 1/2 acre)</option>
                  <option value="large">Large (1/2 - 1 acre)</option>
                  <option value="xlarge">Extra Large (&gt; 1 acre)</option>
                </select>
              </div>

              <div>
                <Label htmlFor="daysSinceLastClean">Days since last yard clean</Label>
                <Input
                  id="daysSinceLastClean"
                  type="number"
                  value={daysSinceLastClean}
                  onChange={(e) => setDaysSinceLastClean(e.target.value)}
                  placeholder="e.g., 30"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Service Type</Label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value as any)}
                    className="w-full border border-brand-300 rounded-xl p-3"
                  >
                    <option value="subscription">Subscription (recurring)</option>
                    <option value="one-time">One-time clean</option>
                  </select>
                </div>
                <div>
                  <Label>Frequency</Label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="w-full border border-brand-300 rounded-xl p-3"
                    disabled={serviceType === 'one-time'}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="twice-weekly">Twice Weekly</option>
                    <option value="bi-weekly">Every other week</option>
                    <option value="one-time">One-time</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Preferred Day</Label>
                  <select
                    value={preferredDay}
                    onChange={(e) => setPreferredDay(e.target.value)}
                    className="w-full border border-brand-300 rounded-xl p-3"
                  >
                    {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Preferred Time</Label>
                  <select
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    className="w-full border border-brand-300 rounded-xl p-3"
                  >
                    {['Morning','Midday','Afternoon'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <Button onClick={() => setStep(2)} className="w-full">
                Next: Service Setup & Payment
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Service Setup & Payment</CardTitle>
              <p className="text-sm text-slate-600">Complete your service setup and payment information</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Service Summary */}
              <div className="bg-brand-50 border border-brand-200 rounded-lg p-4">
                <h4 className="font-semibold text-ink mb-3">Your Service Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">Service:</span>
                    <div className="font-medium">{dogs.filter(d => d.name.trim()).length || 1} dog{dogs.filter(d => d.name.trim()).length > 1 ? 's' : ''}, {yardSize} yard</div>
                  </div>
                  <div>
                    <span className="text-slate-600">Frequency:</span>
                    <div className="font-medium">{frequency.replace('-', ' ')}</div>
                  </div>
                  <div>
                    <span className="text-slate-600">Price:</span>
                    <div className="font-medium">${quoteData?.estimate || '25'} per visit</div>
                  </div>
                  <div>
                    <span className="text-slate-600">Location:</span>
                    <div className="font-medium">{city}</div>
                  </div>
                </div>
              </div>

              {/* Billing Explanation */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">How Billing Works</h4>
                <div className="text-sm text-blue-800 space-y-2">
                  <p>✓ <strong>No upfront payment required</strong> - We only charge after service completion</p>
                  <p>✓ <strong>Deferred billing</strong> - Payment is collected automatically after each visit</p>
                  <p>✓ <strong>Flexible scheduling</strong> - Cancel/reschedule anytime without penalties</p>
                  <p>✓ <strong>Transparent pricing</strong> - Only pay for services actually provided</p>
                </div>
              </div>

              {/* Service Day Selection */}
              <div>
                <Label className="text-base font-medium">Preferred Service Day</Label>
                <select
                  value={preferredDay}
                  onChange={(e) => setPreferredDay(e.target.value)}
                  className="w-full border border-brand-300 rounded-xl p-3 mt-2"
                >
                  {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Service occurs on this day of the week. You can change this anytime.
                </p>
              </div>

              {/* Service Time Selection */}
              <div>
                <Label className="text-base font-medium">Preferred Service Time</Label>
                <select
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  className="w-full border border-brand-300 rounded-xl p-3 mt-2"
                >
                  {['Morning','Midday','Afternoon'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Dog Information */}
              <div>
                <Label className="text-base font-medium">Quick Dog Info (Optional)</Label>
                <p className="text-xs text-slate-500 mb-3">Help us provide better service by telling us about your dogs</p>

                {dogs.map((dog, index) => (
                  <div key={dog.id} className="border rounded-lg p-3 mb-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Dog Name</Label>
                        <Input
                          value={dog.name}
                          onChange={(e) => updateDog(dog.id, 'name', e.target.value)}
                          placeholder={`Dog ${index + 1}`}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Breed (Optional)</Label>
                        <Input
                          value={dog.breed}
                          onChange={(e) => updateDog(dog.id, 'breed', e.target.value)}
                          placeholder="Golden Retriever"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  Back
                </Button>
                <Button onClick={() => setShowPaymentSetup(true)} className="flex-1">
                  Continue to Payment Setup
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Setup Step */}
        {showPaymentSetup && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Setup</CardTitle>
              <p className="text-sm text-slate-600">Add your payment method to complete your account setup</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Service Summary */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">Service Confirmed</h4>
                <div className="text-sm text-green-800 space-y-1">
                  <p>📅 {frequency.replace('-', ' ')} service on {preferredDay}s</p>
                  <p>⏰ Preferred time: {preferredTime}</p>
                  <p>🏠 {city} service area</p>
                  <p>💰 ${quoteData?.estimate || '25'} per completed visit</p>
                </div>
              </div>

              {/* Billing Explanation */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">💳 How Your Payment Works</h4>
                <div className="text-sm text-amber-800 space-y-2">
                  <p>1. <strong>We save your payment method</strong> - No charge today</p>
                  <p>2. <strong>Service completion</strong> - We perform your scheduled service</p>
                  <p>3. <strong>Automatic billing</strong> - You're charged after each completed visit</p>
                  <p>4. <strong>Full control</strong> - Cancel/reschedule anytime without charges</p>
                </div>
              </div>

              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setShowPaymentSetup(false)} className="flex-1">
                  Back to Service Setup
                </Button>
                <Button onClick={handleSignUp} disabled={loading} className="flex-1">
                  {loading ? 'Setting Up Payment...' : 'Complete Account Setup'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
