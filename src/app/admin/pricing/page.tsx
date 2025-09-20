'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { AlertCircle, CheckCircle, Save, DollarSign, Plus, Settings } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BusinessConfig, DEFAULT_YARDURA_CONFIG, AddOnConfig } from '@/lib/business-config';

// Helper function to safely parse numeric inputs
const safeParseNumber = (value: string, fallback: number = 0): number => {
  if (value === '') return fallback;
  if (value === '.' || value === '0.') return 0; // Allow starting to type decimals
  const parsed = Number(value);
  return isNaN(parsed) ? fallback : parsed;
};

// Helper function to safely parse cents (multiplies by 100)
const safeParseCents = (value: string, fallback: number = 0): number => {
  if (value === '') return fallback;
  if (value === '.' || value === '0.') return 0; // Allow starting to type decimals
  const parsed = Number(value);
  return isNaN(parsed) ? fallback : Math.round(parsed * 100);
};

// Combined slider and input component for numeric values
const NumericInputSlider = ({
  value,
  onChange,
  min,
  max,
  step,
  label,
  placeholder
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  label?: string;
  placeholder?: string;
}) => {
  const [inputValue, setInputValue] = useState(value.toString());

  // Update input value when slider changes
  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const handleInputChange = (inputVal: string) => {
    setInputValue(inputVal);
    const parsed = safeParseNumber(inputVal, value);
    if (parsed >= min && parsed <= max) {
      onChange(parsed);
    }
  };

  const handleSliderChange = (sliderVal: number) => {
    onChange(sliderVal);
  };

  return (
    <div className="space-y-2">
      {label && <Label className="text-sm font-medium">{label}</Label>}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => handleSliderChange(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            style={{
              background: `linear-gradient(to right, #2563eb 0%, #2563eb ${((value - min) / (max - min)) * 100}%, #e5e7eb ${((value - min) / (max - min)) * 100}%, #e5e7eb 100%)`
            }}
          />
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
            <div className="bg-accent text-white text-sm font-medium px-2 py-1 rounded shadow-sm">
              {typeof value === 'number' ? value.toFixed(2) : value}
            </div>
          </div>
        </div>
        <Input
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={() => setInputValue(value.toString())} // Reset to actual value on blur
          placeholder={placeholder}
          className="w-20 text-center"
        />
      </div>
    </div>
  );
};

export default function AdminPricingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // All useState hooks MUST be called before any conditional logic
  const [config, setConfig] = useState<BusinessConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Compute businessId after hooks but before conditional returns
  const businessId = (session?.user as any)?.orgId || 'yardura';

  // Define functions before useEffect calls
  const loadConfig = async () => {
    try {
      // Add timestamp to prevent caching
      const response = await fetch(`/api/admin/business-config?businessId=${businessId}&t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        // Use the loaded config directly without merging, since it should be complete
        const loadedConfig = data.config;
        if (loadedConfig && loadedConfig.basePricing) {
          setConfig(loadedConfig);
        } else {
          setConfig(DEFAULT_YARDURA_CONFIG);
        }
      } else {
        // If no config in database, use default
        setConfig(DEFAULT_YARDURA_CONFIG);
      }
    } catch (error) {
      console.error('Error loading config:', error);
      // Fall back to default config
      setConfig(DEFAULT_YARDURA_CONFIG);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;

    setSaving(true);
    try {
      // Ensure the config has all required fields by merging with defaults
      const completeConfig = {
        ...DEFAULT_YARDURA_CONFIG,
        ...config,
        // Make sure service zones are preserved
        serviceZones: config.serviceZones && config.serviceZones.length > 0
          ? config.serviceZones
          : DEFAULT_YARDURA_CONFIG.serviceZones,
      };

      const response = await fetch('/api/admin/business-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          action: 'update',
          config: completeConfig
        }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Pricing configuration saved successfully' });
        // Reload config to get the saved data
        setTimeout(() => loadConfig(), 500); // Small delay to ensure DB commit
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error || 'Failed to save pricing configuration' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save pricing configuration' });
    } finally {
      setSaving(false);
    }
  };

  // ALL useEffect hooks must be called before any conditional logic
  useEffect(() => {
    if (status === 'loading') return; // Still loading

    const userRole = (session as any)?.userRole;
    const isAdmin = userRole === 'ADMIN' || userRole === 'OWNER' || userRole === 'TECH' || userRole === 'SALES_REP';

    if (!session || !isAdmin) {
      router.push('/dashboard');
      return;
    }
  }, [session, status, router]);

  useEffect(() => {
    loadConfig();
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/20">
        <div className="container mx-auto p-6 pt-20">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/20">
        <div className="container mx-auto p-6 pt-20">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Failed to load pricing configuration</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50/30">
      <div className="container mx-auto p-6 pt-20">
        {/* Enhanced header with better visual hierarchy */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-3xl shadow-2xl mx-auto mb-6">
              <DollarSign className="size-10 text-white" />
            </div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-4">
              Pricing Management
            </h1>
            <p className="text-xl text-slate-600 font-medium max-w-2xl mx-auto">
              Configure service pricing, frequencies, and yard size multipliers for your business
            </p>
          </div>

          {/* Enhanced status indicators with better styling */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <div className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl shadow-sm">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-sm"></div>
              <span className="text-sm font-semibold text-green-800">Pricing Engine Active</span>
            </div>
            <div className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl shadow-sm">
              <div className="w-3 h-3 bg-blue-500 rounded-full shadow-sm"></div>
              <span className="text-sm font-semibold text-blue-800">Multi-zone Support</span>
            </div>
            <div className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-2xl shadow-sm">
              <div className="w-3 h-3 bg-purple-500 rounded-full shadow-sm"></div>
              <span className="text-sm font-semibold text-purple-800">Dynamic Add-ons</span>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
              <div className="text-2xl font-bold text-indigo-600">{(config?.basePricing?.tiers || []).length}</div>
              <div className="text-sm text-gray-600">Dog Pricing Tiers</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{(config?.basePricing?.frequencies || []).length}</div>
              <div className="text-sm text-gray-600">Frequency Options</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
              <div className="text-2xl font-bold text-pink-600">{(config?.basePricing?.yardSizes || []).length}</div>
              <div className="text-sm text-gray-600">Yard Size Multipliers</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{(config?.basePricing?.addOns || []).filter(a => a.available).length}</div>
              <div className="text-sm text-gray-600">Active Add-ons</div>
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <Alert className={`mb-6 ${message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {/* Save Button */}
        <div className="flex justify-end mb-6">
          <Button onClick={saveConfig} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Pricing Configuration
              </>
            )}
          </Button>
        </div>

        <div className="space-y-8">
          {/* Base Dog Pricing Tiers */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-indigo-50/30">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-xl">
                  <DollarSign className="w-5 h-5 text-indigo-600" />
                </div>
                <CardTitle className="text-2xl">Dog Count Pricing</CardTitle>
              </div>
              <p className="text-slate-600 ml-11">
                Configure the base pricing for different numbers of dogs. These prices will be multiplied by zone multipliers and add-on costs.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {(config.basePricing?.tiers || []).map((tier, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg">
                    <div>
                      <Label className="text-sm font-medium">Dogs</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={tier.dogCount || ''}
                        onChange={(e) => {
                          const newTiers = [...config.basePricing.tiers];
                          newTiers[index].dogCount = safeParseNumber(e.target.value, tier.dogCount);
                          setConfig({
                            ...config,
                            basePricing: { ...config.basePricing, tiers: newTiers }
                          });
                        }}
                        min="1"
                        max="10"
                      />
                    </div>
                    <div>
                      <NumericInputSlider
                        label="Base Price ($)"
                        value={tier.basePriceCents ? tier.basePriceCents / 100 : 0}
                        onChange={(value) => {
                          const newTiers = [...config.basePricing.tiers];
                          newTiers[index].basePriceCents = safeParseCents(value.toString(), tier.basePriceCents);
                          setConfig({
                            ...config,
                            basePricing: { ...config.basePricing, tiers: newTiers }
                          });
                        }}
                        min={0}
                        max={150}
                        step={0.5}
                        placeholder="25.00"
                      />
                    </div>
                    <div>
                      <NumericInputSlider
                        label="Extra Dog Price ($)"
                        value={tier.extraDogPriceCents ? tier.extraDogPriceCents / 100 : 0}
                        onChange={(value) => {
                          const newTiers = [...config.basePricing.tiers];
                          newTiers[index].extraDogPriceCents = value > 0 ? safeParseCents(value.toString(), tier.extraDogPriceCents) : undefined;
                          setConfig({
                            ...config,
                            basePricing: { ...config.basePricing, tiers: newTiers }
                          });
                        }}
                        min={0}
                        max={50}
                        step={0.5}
                        placeholder="5.00"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newTiers = config.basePricing.tiers.filter((_, i) => i !== index);
                          setConfig({
                            ...config,
                            basePricing: { ...config.basePricing, tiers: newTiers }
                          });
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() => {
                    const newTiers = [...config.basePricing.tiers, {
                      dogCount: config.basePricing.tiers.length + 1,
                      basePriceCents: 2500,
                      extraDogPriceCents: 500
                    }];
                    setConfig({
                      ...config,
                      basePricing: { ...config.basePricing, tiers: newTiers }
                    });
                  }}
                >
                  Add Pricing Tier
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Frequency Multipliers */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-purple-50/30">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl">
                  <DollarSign className="w-5 h-5 text-purple-600" />
                </div>
                <CardTitle className="text-2xl">Service Frequency Multipliers</CardTitle>
              </div>
              <p className="text-slate-600 ml-11">
                Configure multipliers for different service frequencies. Higher frequencies should have higher multipliers.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {(config.basePricing?.frequencies || []).map((freq, index) => (
                  <div key={freq.frequency} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg">
                    <div>
                      <Label className="text-sm font-medium">Frequency</Label>
                      <select
                        className="w-full px-3 py-2 border border-input bg-background rounded-md"
                        value={freq.frequency}
                        onChange={(e) => {
                          const newFreqs = [...config.basePricing.frequencies];
                          newFreqs[index].frequency = e.target.value as any;
                          setConfig({
                            ...config,
                            basePricing: { ...config.basePricing, frequencies: newFreqs }
                          });
                        }}
                      >
                        <option value="weekly">Weekly</option>
                        <option value="twice-weekly">Twice Weekly</option>
                        <option value="bi-weekly">Bi-weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="one-time">One-time</option>
                      </select>
                    </div>
                    <div>
                      <NumericInputSlider
                        label="Multiplier"
                        value={freq.multiplier}
                        onChange={(value) => {
                          const newFreqs = [...config.basePricing.frequencies];
                          newFreqs[index].multiplier = value;
                          setConfig({
                            ...config,
                            basePricing: { ...config.basePricing, frequencies: newFreqs }
                          });
                        }}
                        min={0}
                        max={3.0}
                        step={0.1}
                        placeholder="1.0"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Visits/Month</Label>
                      <Input
                        type="text" inputMode="decimal"
                        value={freq.visitsPerMonth || ''}
                        onChange={(e) => {
                          const newFreqs = [...config.basePricing.frequencies];
                          newFreqs[index].visitsPerMonth = safeParseNumber(e.target.value, freq.visitsPerMonth);
                          setConfig({
                            ...config,
                            basePricing: { ...config.basePricing, frequencies: newFreqs }
                          });
                        }}
                        min="0"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newFreqs = config.basePricing.frequencies.filter((_, i) => i !== index);
                          setConfig({
                            ...config,
                            basePricing: { ...config.basePricing, frequencies: newFreqs }
                          });
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() => {
                    const newFreqs = [...config.basePricing.frequencies, {
                      frequency: 'weekly' as const,
                      multiplier: 1,
                      visitsPerMonth: 4.3
                    }];
                    setConfig({
                      ...config,
                      basePricing: { ...config.basePricing, frequencies: newFreqs }
                    });
                  }}
                >
                  Add Frequency
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Yard Size Multipliers */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-pink-50/30">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-pink-100 to-pink-200 rounded-xl">
                  <DollarSign className="w-5 h-5 text-pink-600" />
                </div>
                <CardTitle className="text-2xl">Yard Size Multipliers</CardTitle>
              </div>
              <p className="text-slate-600 ml-11">
                Configure multipliers for different yard sizes. Larger yards should have higher multipliers.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {(config.basePricing?.yardSizes || []).map((yardSize, index) => (
                  <div key={yardSize.size} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg">
                    <div>
                      <Label className="text-sm font-medium">Size</Label>
                      <select
                        className="w-full px-3 py-2 border border-input bg-background rounded-md"
                        value={yardSize.size}
                        onChange={(e) => {
                          const newYardSizes = [...config.basePricing.yardSizes];
                          newYardSizes[index].size = e.target.value as any;
                          setConfig({
                            ...config,
                            basePricing: { ...config.basePricing, yardSizes: newYardSizes }
                          });
                        }}
                      >
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                        <option value="xlarge">X-Large</option>
                      </select>
                    </div>
                    <div>
                      <NumericInputSlider
                        label="Multiplier"
                        value={yardSize.multiplier}
                        onChange={(value) => {
                          const newYardSizes = [...config.basePricing.yardSizes];
                          newYardSizes[index].multiplier = value;
                          setConfig({
                            ...config,
                            basePricing: { ...config.basePricing, yardSizes: newYardSizes }
                          });
                        }}
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        placeholder="1.0"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-sm font-medium">Description</Label>
                      <Input
                        value={yardSize.description}
                        onChange={(e) => {
                          const newYardSizes = [...config.basePricing.yardSizes];
                          newYardSizes[index].description = e.target.value;
                          setConfig({
                            ...config,
                            basePricing: { ...config.basePricing, yardSizes: newYardSizes }
                          });
                        }}
                        placeholder="e.g., Townhouse or small lot"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Initial Clean Pricing */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-green-50/30">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-green-100 to-green-200 rounded-xl">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <CardTitle className="text-2xl">Initial Clean Pricing</CardTitle>
              </div>
              <p className="text-slate-600 ml-11">
                Configure pricing for initial cleanups based on time since last service. Higher multipliers apply to more neglected yards.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {(config.basePricing?.initialClean?.buckets || []).map((bucket, index) => (
                  <div key={bucket.bucket} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border rounded-lg">
                    <div>
                      <Label className="text-sm font-medium">Bucket (Days)</Label>
                      <Input
                        type="text"
                        value={bucket.bucket}
                        onChange={(e) => {
                          const newBuckets = [...config.basePricing.initialClean.buckets];
                          newBuckets[index].bucket = e.target.value;
                          setConfig({
                            ...config,
                            basePricing: {
                              ...config.basePricing,
                              initialClean: { ...config.basePricing.initialClean, buckets: newBuckets }
                            }
                          });
                        }}
                        placeholder="e.g., 14"
                      />
                    </div>
                    <div>
                      <NumericInputSlider
                        label="Multiplier"
                        value={bucket.multiplier}
                        onChange={(value) => {
                          const newBuckets = [...config.basePricing.initialClean.buckets];
                          newBuckets[index].multiplier = value;
                          setConfig({
                            ...config,
                            basePricing: {
                              ...config.basePricing,
                              initialClean: { ...config.basePricing.initialClean, buckets: newBuckets }
                            }
                          });
                        }}
                        min={0.5}
                        max={3.0}
                        step={0.1}
                        placeholder="1.0"
                      />
                    </div>
                    <div>
                      <NumericInputSlider
                        label="Floor Price ($)"
                        value={bucket.floorPriceCents ? bucket.floorPriceCents / 100 : 0}
                        onChange={(value) => {
                          const newBuckets = [...config.basePricing.initialClean.buckets];
                          newBuckets[index].floorPriceCents = safeParseCents(value.toString(), bucket.floorPriceCents);
                          setConfig({
                            ...config,
                            basePricing: {
                              ...config.basePricing,
                              initialClean: { ...config.basePricing.initialClean, buckets: newBuckets }
                            }
                          });
                        }}
                        min={0}
                        max={200}
                        step={1}
                        placeholder="49.00"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-sm font-medium">Label</Label>
                      <Input
                        value={bucket.label}
                        onChange={(e) => {
                          const newBuckets = [...config.basePricing.initialClean.buckets];
                          newBuckets[index].label = e.target.value;
                          setConfig({
                            ...config,
                            basePricing: {
                              ...config.basePricing,
                              initialClean: { ...config.basePricing.initialClean, buckets: newBuckets }
                            }
                          });
                        }}
                        placeholder="Description of this cleanup bucket"
                      />
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() => {
                    const newBuckets = [...(config.basePricing.initialClean.buckets || []), {
                      bucket: '30',
                      multiplier: 1.0,
                      floorPriceCents: 4900,
                      label: 'New bucket'
                    }];
                    setConfig({
                      ...config,
                      basePricing: {
                        ...config.basePricing,
                        initialClean: { ...config.basePricing.initialClean, buckets: newBuckets }
                      }
                    });
                  }}
                >
                  Add Cleanup Bucket
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Areas Pricing */}
          <Card>
            <CardHeader>
              <CardTitle>Areas Pricing</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure pricing for service areas. The first area is always free, with additional costs for each extra area.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium">Free Areas</Label>
                  <Input
                    type="text" inputMode="decimal"
                    value={config.basePricing?.areaPricing?.baseAreas || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      basePricing: {
                        ...config.basePricing,
                        areaPricing: {
                          ...config.basePricing.areaPricing,
                          baseAreas: safeParseNumber(e.target.value, config.basePricing?.areaPricing?.baseAreas || 1)
                        }
                      }
                    })}
                    min="0"
                  />
                  <p className="text-xs text-muted mt-1">Number of areas included free</p>
                </div>
                <div>
                  <NumericInputSlider
                    label="One-time Extra ($)"
                    value={config.basePricing?.areaPricing?.extraAreaCostCents ? (config.basePricing.areaPricing.extraAreaCostCents / 100) : 0}
                    onChange={(value) => setConfig({
                      ...config,
                      basePricing: {
                        ...config.basePricing,
                        areaPricing: {
                          ...config.basePricing.areaPricing,
                          extraAreaCostCents: safeParseCents(value.toString(), config.basePricing?.areaPricing?.extraAreaCostCents)
                        }
                      }
                    })}
                    min={0}
                    max={20}
                    step={0.5}
                    placeholder="5.00"
                  />
                  <p className="text-xs text-muted mt-1">Cost per additional area for one-time service</p>
                </div>
                <div>
                  <NumericInputSlider
                    label="Recurring Extra ($)"
                    value={config.basePricing?.areaPricing?.recurringExtraAreaCostCents ? (config.basePricing.areaPricing.recurringExtraAreaCostCents / 100) : 0}
                    onChange={(value) => setConfig({
                      ...config,
                      basePricing: {
                        ...config.basePricing,
                        areaPricing: {
                          ...config.basePricing.areaPricing,
                          recurringExtraAreaCostCents: safeParseCents(value.toString(), config.basePricing?.areaPricing?.recurringExtraAreaCostCents)
                        }
                      }
                    })}
                    min={0}
                    max={15}
                    step={0.5}
                    placeholder="3.00"
                  />
                  <p className="text-xs text-muted mt-1">Cost per additional area for recurring service</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add-ons Pricing */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-purple-50/30">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl">
                  <Settings className="w-5 h-5 text-purple-600" />
                </div>
                <CardTitle className="text-2xl">Service Add-ons</CardTitle>
              </div>
              <p className="text-slate-600 ml-11">
                Configure pricing and availability for premium service add-ons. Each add-on supports multiple billing modes.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {(config.basePricing?.addOns || []).map((addon, originalIndex) => {
                  // Skip spray-deck and litter add-ons
                  if (addon.id === 'spray-deck' || addon.id === 'litter') return null;
                  return (
                  <div key={addon.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {/* Add-on Header */}
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`available-${addon.id}`}
                              checked={addon.available}
                              onChange={(e) => {
                                const newAddOns = [...config.basePricing.addOns];
                                newAddOns[originalIndex].available = e.target.checked;
                                setConfig({
                                  ...config,
                                  basePricing: { ...config.basePricing, addOns: newAddOns }
                                });
                              }}
                              className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500"
                            />
                            <Label htmlFor={`available-${addon.id}`} className="text-sm font-medium text-gray-700">
                              Available
                            </Label>
                          </div>
                          <div className="h-4 w-px bg-gray-300"></div>
                          <h3 className="font-semibold text-gray-900">{addon.name}</h3>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newAddOns = (config.basePricing.addOns || []).filter((_, i) => i !== originalIndex);
                            setConfig({
                              ...config,
                              basePricing: { ...config.basePricing, addOns: newAddOns }
                            });
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>

                    {/* Add-on Details */}
                    <div className="p-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-700">Add-on ID</Label>
                          <Input
                            value={addon.id}
                            onChange={(e) => {
                              const newAddOns = [...config.basePricing.addOns];
                              newAddOns[originalIndex].id = e.target.value;
                              setConfig({
                                ...config,
                                basePricing: { ...config.basePricing, addOns: newAddOns }
                              });
                            }}
                            placeholder="unique-id"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-700">Display Name</Label>
                          <Input
                            value={addon.name}
                          onChange={(e) => {
                            const newAddOns = [...config.basePricing.addOns];
                            newAddOns[originalIndex].name = e.target.value;
                            setConfig({
                              ...config,
                              basePricing: { ...config.basePricing, addOns: newAddOns }
                            });
                          }}
                            placeholder="Service name"
                            className="mt-1"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium text-gray-700">Description</Label>
                        <Input
                          value={addon.description}
                          onChange={(e) => {
                            const newAddOns = [...config.basePricing.addOns];
                            newAddOns[originalIndex].description = e.target.value;
                            setConfig({
                              ...config,
                              basePricing: { ...config.basePricing, addOns: newAddOns }
                            });
                          }}
                          placeholder="Brief description of the service"
                          className="mt-1"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <NumericInputSlider
                            label="Base Price ($)"
                            value={addon.priceCents ? addon.priceCents / 100 : 0}
                            onChange={(value) => {
                              const newAddOns = [...config.basePricing.addOns];
                              newAddOns[originalIndex].priceCents = safeParseCents(value.toString(), addon.priceCents);
                              setConfig({
                                ...config,
                                basePricing: { ...config.basePricing, addOns: newAddOns }
                              });
                            }}
                            min={0}
                            max={addon.id.startsWith('divert') ? 20 : 100} // Lower max for diversion add-ons
                            step={addon.id.startsWith('divert') ? 0.5 : 1} // Smaller steps for diversion add-ons
                            placeholder={addon.id.startsWith('divert') ? "2.00" : "25.00"}
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-700">Default Billing Mode</Label>
                          <select
                            className="w-full px-3 py-2 mt-1 border border-gray-300 bg-white rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                            value={addon.billingMode}
                            onChange={(e) => {
                              const newAddOns = [...config.basePricing.addOns];
                              newAddOns[originalIndex].billingMode = e.target.value as any;
                              setConfig({
                                ...config,
                                basePricing: { ...config.basePricing, addOns: newAddOns }
                              });
                            }}
                          >
                            <option value="first-visit">First Visit Only</option>
                            <option value="each-visit">Each Visit</option>
                            <option value="every-other">Every Other Visit</option>
                            <option value="one-time">One-time</option>
                          </select>
                        </div>
                      </div>

                      {/* Billing Mode Availability */}
                      <div>
                        <Label className="text-sm font-medium text-gray-700 mb-3 block">Available Billing Modes</Label>
                        <p className="text-xs text-gray-500 mb-3">Customers can choose from these billing options during quote</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { value: 'first-visit', label: 'First Visit', description: 'One-time charge' },
                            { value: 'each-visit', label: 'Each Visit', description: 'Per visit charge' },
                            { value: 'every-other', label: 'Every Other', description: 'Half price frequency' },
                            { value: 'one-time', label: 'One-time', description: 'Single service' }
                          ].map((mode) => (
                            <div key={mode.value} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                              <input
                                type="checkbox"
                                id={`${addon.id}-${mode.value}`}
                                checked={addon.available} // For now, all modes are available if addon is available
                                onChange={() => {
                                  // Future: implement per-mode availability
                                }}
                                className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500"
                              />
                              <div>
                                <Label htmlFor={`${addon.id}-${mode.value}`} className="text-xs font-medium text-gray-700">
                                  {mode.label}
                                </Label>
                                <p className="text-xs text-gray-500">{mode.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}

              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
