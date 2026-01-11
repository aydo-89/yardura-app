import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import type { CustomerSummary } from '@/lib/api/types';

type YardSize = 'small' | 'medium' | 'large' | 'xlarge';
type Frequency = 'weekly' | 'twice-weekly' | 'bi-weekly' | 'monthly';
type Step = 'overview' | 'details' | 'address' | 'pricing' | 'payment' | 'success';

interface PricingResult {
  perVisit: number;
  monthly: number;
  oneTime: number;
  visitsPerMonth: number;
  initialClean?: number;
  breakdown?: {
    basePrice: number;
    yardAdder: number;
    frequencyMultiplier: number;
    addOnCents: number;
  };
}

interface LeadResponse {
  ok: boolean;
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    dogs: number;
    yardSize: string;
    frequency: string;
  };
}

const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

export default function ServiceSignupScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  // Step navigation
  const [step, setStep] = useState<Step>('overview');

  // Customer data (pre-loaded)
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Service details
  const [dogs, setDogs] = useState(1);
  const [yardSize, setYardSize] = useState<YardSize>('medium');
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [addOns, setAddOns] = useState({ deodorize: false, litter: false });

  // Address info
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [gateCode, setGateCode] = useState('');
  const [accessNotes, setAccessNotes] = useState('');
  const [showStatePicker, setShowStatePicker] = useState(false);

  // Pricing
  const [pricing, setPricing] = useState<PricingResult | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  // Lead & payment
  const [leadId, setLeadId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load customer summary on mount
  useEffect(() => {
    const loadSummary = async () => {
      if (!session?.token) return;
      try {
        const data = await apiRequest<CustomerSummary>('/api/mobile/customer/summary', {
          token: session.token,
        });
        setSummary(data);

        // Pre-fill address from customer data
        if (data.customer) {
          setCity(data.customer.city || '');
          setState(data.customer.state || '');
          setZipCode(data.customer.zip || '');
        }

        // Pre-fill dog count from petsCount
        if (data.petsCount && data.petsCount > 0) {
          setDogs(data.petsCount);
        }
      } catch (err) {
        console.error('Failed to load summary:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [session?.token]);

  // Calculate pricing when details change
  const calculatePricing = useCallback(async () => {
    if (!session?.token) return;
    setPricingLoading(true);
    setError(null);
    try {
      const result = await apiRequest<PricingResult>('/api/quote/calculate-price', {
        method: 'POST',
        token: session.token,
        body: {
          dogs,
          yardSize,
          frequency,
          addons: addOns,
          businessId: 'yardura',
        },
      });
      setPricing(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to calculate pricing';
      setError(message);
    } finally {
      setPricingLoading(false);
    }
  }, [session?.token, dogs, yardSize, frequency, addOns]);

  // Calculate pricing when moving to pricing step
  useEffect(() => {
    if (step === 'pricing') {
      calculatePricing();
    }
  }, [step, calculatePricing]);

  // Create lead
  const createLead = useCallback(async (): Promise<string | null> => {
    if (!session?.token || !session.user) return null;

    const firstName = session.user.name?.split(' ')[0] || '';
    const lastName = session.user.name?.split(' ').slice(1).join(' ') || '';

    try {
      const response = await apiRequest<LeadResponse>('/api/mobile/leads/create', {
        method: 'POST',
        token: session.token,
        body: {
          firstName,
          lastName,
          email: session.user.email,
          phone: summary?.contact?.phone || '',
          address,
          city,
          state,
          zipCode,
          dogs,
          yardSize,
          frequency,
          deodorize: addOns.deodorize,
          serviceType: 'residential',
          source: 'mobile-app-upgrade',
          pricingBreakdown: pricing,
        },
      });

      return response.lead.id;
    } catch (err) {
      console.error('Failed to create lead:', err);
      throw err;
    }
  }, [session, summary, address, city, state, zipCode, dogs, yardSize, frequency, addOns, pricing]);

  // Handle step navigation
  const goToStep = (nextStep: Step) => {
    setError(null);
    setStep(nextStep);
  };

  // Handle payment - opens web checkout
  const handlePayment = async () => {
    if (!session?.token) {
      setError('Please sign in to continue');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Step 1: Create lead if not already created
      let currentLeadId = leadId;
      if (!currentLeadId) {
        currentLeadId = await createLead();
        if (!currentLeadId) {
          throw new Error('Failed to create service request');
        }
        setLeadId(currentLeadId);
      }

      // Step 2: Open web checkout with the lead ID
      const email = encodeURIComponent(session.user?.email || '');
      const checkoutUrl = `https://www.getinsightscoop.com/onboarding/start?leadId=${currentLeadId}&email=${email}&source=mobile-app`;

      const result = await WebBrowser.openBrowserAsync(checkoutUrl, {
        showTitle: true,
        enableDefaultShareMenuItem: false,
      });

      // After browser closes, check if onboarding was completed
      if (result.type === 'dismiss' || result.type === 'cancel') {
        // Check lead status to see if conversion happened
        try {
          const leadCheck = await apiRequest<{ status: string }>(
            `/api/mobile/leads/${currentLeadId}/status`,
            { token: session.token },
          );

          if (leadCheck.status === 'WON') {
            goToStep('success');
          } else {
            // User closed without completing - that's okay
            setError('Complete payment on the website to finish signup');
          }
        } catch {
          // Lead check failed, assume not completed
          setError('Complete payment on the website to finish signup');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start checkout';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Format currency
  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Frequency labels
  const frequencyLabels: Record<Frequency, string> = {
    weekly: 'Weekly',
    'twice-weekly': 'Twice Weekly',
    'bi-weekly': 'Every Other Week',
    monthly: 'Monthly',
  };

  // Yard size labels
  const yardSizeLabels: Record<YardSize, string> = {
    small: 'Small (< 1/4 acre)',
    medium: 'Medium (1/4 - 1/2 acre)',
    large: 'Large (1/2 - 1 acre)',
    xlarge: 'Extra Large (> 1 acre)',
  };

  // Render step indicator
  const renderStepIndicator = () => {
    const steps: Step[] = ['overview', 'details', 'address', 'pricing', 'payment'];
    const currentIndex = steps.indexOf(step);
    if (step === 'success') return null;

    return (
      <View style={styles.stepIndicator}>
        {steps.map((s, i) => (
          <View
            key={s}
            style={[
              styles.stepDot,
              {
                backgroundColor: i <= currentIndex ? palette.tint : palette.border,
              },
            ]}
          />
        ))}
      </View>
    );
  };

  // Render overview step
  const renderOverview = () => (
    <View style={styles.stepContent}>
      <View style={[styles.heroCard, { backgroundColor: palette.tint }]}>
        <View style={styles.heroIconWrap}>
          <FontAwesome name="truck" size={32} color="#FFFFFF" />
        </View>
        <Text style={styles.heroTitle}>Professional Poop Scooping</Text>
        <Text style={styles.heroSubtitle}>
          Get a clean yard and pro-verified wellness insights
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>What's included</Text>
        <View style={styles.featureList}>
          {[
            'Scheduled weekly cleanup visits',
            'Pro-captured stool photos each visit',
            'Unlimited wellness scans & AI chat',
            'Health alerts and vet-ready reports',
            'Gate access & no-contact service',
            'Satisfaction guaranteed',
          ].map((feature, i) => (
            <View key={i} style={styles.featureRow}>
              <FontAwesome name="check-circle" size={16} color={Colors.brand.mint} />
              <Text style={[styles.featureText, { color: palette.text }]}>{feature}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>How it works</Text>
        <View style={styles.stepsList}>
          <View style={styles.stepsRow}>
            <View style={[styles.stepNumber, { backgroundColor: `${palette.tint}20` }]}>
              <Text style={[styles.stepNumberText, { color: palette.tint }]}>1</Text>
            </View>
            <Text style={[styles.stepsText, { color: palette.text }]}>
              Tell us about your yard and schedule
            </Text>
          </View>
          <View style={styles.stepsRow}>
            <View style={[styles.stepNumber, { backgroundColor: `${palette.tint}20` }]}>
              <Text style={[styles.stepNumberText, { color: palette.tint }]}>2</Text>
            </View>
            <Text style={[styles.stepsText, { color: palette.text }]}>
              Add your payment method
            </Text>
          </View>
          <View style={styles.stepsRow}>
            <View style={[styles.stepNumber, { backgroundColor: `${palette.tint}20` }]}>
              <Text style={[styles.stepNumberText, { color: palette.tint }]}>3</Text>
            </View>
            <Text style={[styles.stepsText, { color: palette.text }]}>
              We handle the rest - first visit in ~3 days
            </Text>
          </View>
        </View>
      </View>

      <Button title="Get Started" onPress={() => goToStep('details')} />
    </View>
  );

  // Render details step
  const renderDetails = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: palette.text }]}>Service Details</Text>
      <Text style={[styles.stepSubtitle, { color: palette.muted }]}>
        Tell us about your yard so we can give you accurate pricing.
      </Text>

      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.label, { color: palette.text }]}>How many dogs?</Text>
        <View style={styles.counterRow}>
          <Pressable
            onPress={() => setDogs(Math.max(1, dogs - 1))}
            style={[styles.counterBtn, { borderColor: palette.border }]}
          >
            <FontAwesome name="minus" size={16} color={palette.text} />
          </Pressable>
          <Text style={[styles.counterValue, { color: palette.text }]}>{dogs}</Text>
          <Pressable
            onPress={() => setDogs(Math.min(10, dogs + 1))}
            style={[styles.counterBtn, { borderColor: palette.border }]}
          >
            <FontAwesome name="plus" size={16} color={palette.text} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.label, { color: palette.text }]}>Yard Size</Text>
        <View style={styles.optionGrid}>
          {(['small', 'medium', 'large', 'xlarge'] as YardSize[]).map((size) => (
            <Pressable
              key={size}
              onPress={() => setYardSize(size)}
              style={[
                styles.optionCard,
                {
                  borderColor: yardSize === size ? palette.tint : palette.border,
                  backgroundColor: yardSize === size ? `${palette.tint}10` : palette.card,
                },
              ]}
            >
              <Text
                style={[
                  styles.optionLabel,
                  { color: yardSize === size ? palette.tint : palette.text },
                ]}
              >
                {yardSizeLabels[size]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.label, { color: palette.text }]}>Service Frequency</Text>
        <View style={styles.optionGrid}>
          {(['weekly', 'twice-weekly', 'bi-weekly', 'monthly'] as Frequency[]).map((freq) => (
            <Pressable
              key={freq}
              onPress={() => setFrequency(freq)}
              style={[
                styles.optionCard,
                {
                  borderColor: frequency === freq ? palette.tint : palette.border,
                  backgroundColor: frequency === freq ? `${palette.tint}10` : palette.card,
                },
              ]}
            >
              <Text
                style={[
                  styles.optionLabel,
                  { color: frequency === freq ? palette.tint : palette.text },
                ]}
              >
                {frequencyLabels[freq]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.buttonRow}>
        <Button title="Back" onPress={() => goToStep('overview')} variant="secondary" />
        <Button title="Next" onPress={() => goToStep('address')} />
      </View>
    </View>
  );

  // Render address step
  const renderAddress = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: palette.text }]}>Service Address</Text>
      <Text style={[styles.stepSubtitle, { color: palette.muted }]}>
        Confirm where we'll be visiting.
      </Text>

      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.label, { color: palette.text }]}>Street Address</Text>
        <TextInput
          placeholder="123 Main St"
          placeholderTextColor={palette.muted}
          style={[styles.input, { color: palette.text, borderColor: palette.border }]}
          value={address}
          onChangeText={setAddress}
        />

        <Text style={[styles.label, { color: palette.text }]}>City</Text>
        <TextInput
          placeholder="City"
          placeholderTextColor={palette.muted}
          style={[styles.input, { color: palette.text, borderColor: palette.border }]}
          value={city}
          onChangeText={setCity}
        />

        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={[styles.label, { color: palette.text }]}>State</Text>
            <Pressable
              onPress={() => setShowStatePicker(!showStatePicker)}
              style={[styles.input, styles.pickerButton, { borderColor: palette.border }]}
            >
              <Text style={{ color: state ? palette.text : palette.muted }}>
                {state || 'Select state'}
              </Text>
              <FontAwesome name="chevron-down" size={12} color={palette.muted} />
            </Pressable>
            {showStatePicker ? (
              <View style={[styles.stateDropdown, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <ScrollView style={styles.stateDropdownScroll} nestedScrollEnabled>
                  {US_STATES.map((s) => (
                    <Pressable
                      key={s.value}
                      onPress={() => {
                        setState(s.value);
                        setShowStatePicker(false);
                      }}
                      style={[
                        styles.stateOption,
                        state === s.value && { backgroundColor: `${palette.tint}10` },
                      ]}
                    >
                      <Text style={{ color: state === s.value ? palette.tint : palette.text }}>
                        {s.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
          <View style={styles.halfField}>
            <Text style={[styles.label, { color: palette.text }]}>ZIP Code</Text>
            <TextInput
              placeholder="12345"
              placeholderTextColor={palette.muted}
              style={[styles.input, { color: palette.text, borderColor: palette.border }]}
              value={zipCode}
              onChangeText={setZipCode}
              keyboardType="numeric"
              maxLength={5}
            />
          </View>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.label, { color: palette.text }]}>Gate Code (if applicable)</Text>
        <TextInput
          placeholder="Optional - gate or lock code"
          placeholderTextColor={palette.muted}
          style={[styles.input, { color: palette.text, borderColor: palette.border }]}
          value={gateCode}
          onChangeText={setGateCode}
        />

        <Text style={[styles.label, { color: palette.text }]}>Access Notes</Text>
        <TextInput
          placeholder="Any special instructions for accessing your yard"
          placeholderTextColor={palette.muted}
          style={[styles.input, styles.textArea, { color: palette.text, borderColor: palette.border }]}
          value={accessNotes}
          onChangeText={setAccessNotes}
          multiline
          numberOfLines={3}
        />
      </View>

      {error ? <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text> : null}

      <View style={styles.buttonRow}>
        <Button title="Back" onPress={() => goToStep('details')} variant="secondary" />
        <Button
          title="Review Pricing"
          onPress={() => {
            if (!address || !city || !state || !zipCode) {
              setError('Please complete all address fields');
              return;
            }
            goToStep('pricing');
          }}
        />
      </View>
    </View>
  );

  // Render pricing step
  const renderPricing = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: palette.text }]}>Your Price</Text>
      <Text style={[styles.stepSubtitle, { color: palette.muted }]}>
        Review your service plan and pricing.
      </Text>

      {pricingLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.tint} />
          <Text style={[styles.loadingText, { color: palette.muted }]}>Calculating...</Text>
        </View>
      ) : pricing ? (
        <>
          <View style={[styles.pricingCard, { backgroundColor: palette.tint }]}>
            <Text style={styles.pricingLabel}>Monthly Cost</Text>
            <Text style={styles.pricingValue}>{formatPrice(pricing.monthly)}</Text>
            <Text style={styles.pricingMeta}>
              {formatPrice(pricing.perVisit)} per visit · {pricing.visitsPerMonth.toFixed(1)} visits/month
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Service Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: palette.muted }]}>Dogs</Text>
              <Text style={[styles.summaryValue, { color: palette.text }]}>{dogs}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: palette.muted }]}>Yard Size</Text>
              <Text style={[styles.summaryValue, { color: palette.text }]}>
                {yardSizeLabels[yardSize]}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: palette.muted }]}>Frequency</Text>
              <Text style={[styles.summaryValue, { color: palette.text }]}>
                {frequencyLabels[frequency]}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: palette.muted }]}>Address</Text>
              <Text style={[styles.summaryValue, { color: palette.text }]} numberOfLines={2}>
                {address}, {city}, {state} {zipCode}
              </Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: `${Colors.brand.mint}10`, borderColor: Colors.brand.mint }]}>
            <View style={styles.promoRow}>
              <FontAwesome name="gift" size={20} color={Colors.brand.mint} />
              <View style={styles.promoText}>
                <Text style={[styles.promoTitle, { color: palette.text }]}>
                  Free Trial Week
                </Text>
                <Text style={[styles.promoBody, { color: palette.muted }]}>
                  Your first week is on us. No charge until after your trial.
                </Text>
              </View>
            </View>
          </View>
        </>
      ) : error ? (
        <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
      ) : null}

      <View style={styles.buttonRow}>
        <Button title="Back" onPress={() => goToStep('address')} variant="secondary" />
        <Button
          title="Continue to Payment"
          onPress={() => goToStep('payment')}
          disabled={!pricing || pricingLoading}
        />
      </View>
    </View>
  );

  // Render payment step
  const renderPayment = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardView}
    >
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, { color: palette.text }]}>Complete Signup</Text>
        <Text style={[styles.stepSubtitle, { color: palette.muted }]}>
          Add your payment method to start your free trial.
        </Text>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.paymentInfoRow}>
            <View style={[styles.paymentIcon, { backgroundColor: `${palette.tint}15` }]}>
              <FontAwesome name="lock" size={20} color={palette.tint} />
            </View>
            <View style={styles.paymentInfoText}>
              <Text style={[styles.paymentInfoTitle, { color: palette.text }]}>
                Secure Payment
              </Text>
              <Text style={[styles.paymentInfoBody, { color: palette.muted }]}>
                You'll be redirected to complete payment securely. Your card won't be charged during the trial.
              </Text>
            </View>
          </View>
        </View>

        {pricing ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: palette.muted }]}>Due today</Text>
              <Text style={[styles.summaryValue, { color: Colors.brand.mint, fontWeight: '700' }]}>
                $0.00
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: palette.muted }]}>After trial</Text>
              <Text style={[styles.summaryValue, { color: palette.text }]}>
                {formatPrice(pricing.monthly)}/month
              </Text>
            </View>
          </View>
        ) : null}

        {error ? <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text> : null}

        <Text style={[styles.disclaimer, { color: palette.muted }]}>
          By continuing, you agree to our terms of service. Your trial includes your first week
          free. Cancel anytime.
        </Text>

        <View style={styles.buttonRow}>
          <Button title="Back" onPress={() => goToStep('pricing')} variant="secondary" />
          <Button
            title={submitting ? 'Processing...' : 'Start Free Trial'}
            onPress={handlePayment}
            disabled={submitting}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  // Render success step
  const renderSuccess = () => (
    <View style={styles.stepContent}>
      <View style={[styles.successCard, { backgroundColor: Colors.brand.mint }]}>
        <View style={styles.successIconWrap}>
          <FontAwesome name="check" size={40} color={Colors.brand.mint} />
        </View>
        <Text style={styles.successTitle}>You're All Set!</Text>
        <Text style={styles.successSubtitle}>
          Welcome to InsightScoop. Your first visit is being scheduled.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>What's Next</Text>
        <View style={styles.stepsList}>
          <View style={styles.stepsRow}>
            <View style={[styles.stepNumber, { backgroundColor: `${Colors.brand.mint}20` }]}>
              <FontAwesome name="calendar" size={14} color={Colors.brand.mint} />
            </View>
            <Text style={[styles.stepsText, { color: palette.text }]}>
              Your first visit will be scheduled within 2-3 business days
            </Text>
          </View>
          <View style={styles.stepsRow}>
            <View style={[styles.stepNumber, { backgroundColor: `${Colors.brand.mint}20` }]}>
              <FontAwesome name="bell" size={14} color={Colors.brand.mint} />
            </View>
            <Text style={[styles.stepsText, { color: palette.text }]}>
              You'll get a notification when your scooper is on the way
            </Text>
          </View>
          <View style={styles.stepsRow}>
            <View style={[styles.stepNumber, { backgroundColor: `${Colors.brand.mint}20` }]}>
              <FontAwesome name="camera" size={14} color={Colors.brand.mint} />
            </View>
            <Text style={[styles.stepsText, { color: palette.text }]}>
              After each visit, check your app for wellness insights
            </Text>
          </View>
        </View>
      </View>

      <Button
        title="Go to Home"
        onPress={() => router.replace('/(app)/(customer)')}
      />
    </View>
  );

  // Render current step
  const renderStep = () => {
    switch (step) {
      case 'overview':
        return renderOverview();
      case 'details':
        return renderDetails();
      case 'address':
        return renderAddress();
      case 'pricing':
        return renderPricing();
      case 'payment':
        return renderPayment();
      case 'success':
        return renderSuccess();
      default:
        return renderOverview();
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.tint} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderStepIndicator()}
        {renderStep()}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepContent: {
    gap: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  stepSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  keyboardView: {
    flex: 1,
  },
  heroCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  featureList: {
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    flex: 1,
  },
  stepsList: {
    gap: 12,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
  },
  stepsText: {
    fontSize: 14,
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  stateDropdown: {
    position: 'absolute',
    top: 72,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: 12,
    zIndex: 1000,
    maxHeight: 200,
  },
  stateDropdownScroll: {
    maxHeight: 200,
  },
  stateOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  counterBtn: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    fontSize: 24,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'center',
  },
  optionGrid: {
    gap: 10,
  },
  optionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  pricingCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  pricingLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.8)',
  },
  pricingValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  pricingMeta: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
  promoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  promoText: {
    flex: 1,
    gap: 2,
  },
  promoTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  promoBody: {
    fontSize: 13,
  },
  paymentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentInfoText: {
    flex: 1,
    gap: 4,
  },
  paymentInfoTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  paymentInfoBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  successCard: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  successIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  successSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
});
