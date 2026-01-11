import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import type { CustomerSetupResponse } from '@/lib/api/types';

export default function CustomerSetup() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [phone, setPhone] = useState('');

  const loadSetup = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<CustomerSetupResponse>(
        '/api/mobile/customer/setup',
        { token: session.token },
      );
      if (data.hasCustomer) {
        router.replace('/(app)/(customer)');
        return;
      }
      setName(data.setup.name ?? '');
      setAddressLine1(data.setup.addressLine1 ?? '');
      setCity(data.setup.city ?? '');
      setState(data.setup.state ?? '');
      setZip(data.setup.zip ?? '');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load setup.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    loadSetup();
  }, [loadSetup]);

  const handleSubmit = async () => {
    if (!session?.token || saving) return;
    if (!name.trim() || !addressLine1.trim() || !city.trim() || !state.trim() || !zip.trim()) {
      setError('Please complete all required fields.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/api/mobile/customer/setup', {
        method: 'POST',
        token: session.token,
        body: {
          name: name.trim(),
          addressLine1: addressLine1.trim(),
          city: city.trim(),
          state: state.trim(),
          zip: zip.trim(),
          phone: phone.trim() ? phone.trim() : null,
        },
      });
      router.replace('/(app)/(customer)/welcome' as any);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save account.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const heroBackground =
    colorScheme === 'light' ? Colors.brand.graphite : '#1E293B';

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={[styles.hero, { backgroundColor: heroBackground }]}
          >
            <View
              style={[
                styles.heroGlow,
                { backgroundColor: palette.tint, opacity: colorScheme === 'light' ? 0.25 : 0.4 },
              ]}
            />
            <View
              style={[
                styles.heroGlowSecondary,
                { backgroundColor: palette.accent, opacity: colorScheme === 'light' ? 0.2 : 0.3 },
              ]}
            />
            <Text style={[styles.heroEyebrow, { color: 'rgba(255,255,255,0.7)' }]}
            >
              Free customer access
            </Text>
            <Text style={styles.heroTitle}>Finish your customer profile</Text>
            <Text style={[styles.heroSubtitle, { color: 'rgba(255,255,255,0.7)' }]}
            >
              Complete the required details to unlock your customer dashboard.
            </Text>
          </View>

          <View style={[styles.formCard, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            {loading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator size="small" color={palette.tint} />
                <Text style={[styles.cardBody, { color: palette.muted }]}
                >
                  Loading your profile...
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: palette.text }]}>
                    Full name
                  </Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Full name"
                    placeholderTextColor={palette.muted}
                    style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: palette.text }]}>
                    Address
                  </Text>
                  <TextInput
                    value={addressLine1}
                    onChangeText={setAddressLine1}
                    placeholder="Street address"
                    placeholderTextColor={palette.muted}
                    style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                  />
                </View>
                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, styles.inputHalf]}>
                    <Text style={[styles.inputLabel, { color: palette.text }]}>
                      City
                    </Text>
                    <TextInput
                      value={city}
                      onChangeText={setCity}
                      placeholder="City"
                      placeholderTextColor={palette.muted}
                      style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                    />
                  </View>
                  <View style={[styles.inputGroup, styles.inputSmall]}>
                    <Text style={[styles.inputLabel, { color: palette.text }]}>
                      State
                    </Text>
                    <TextInput
                      value={state}
                      onChangeText={setState}
                      placeholder="ST"
                      placeholderTextColor={palette.muted}
                      autoCapitalize="characters"
                      maxLength={2}
                      style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                    />
                  </View>
                </View>
                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, styles.inputHalf]}>
                    <Text style={[styles.inputLabel, { color: palette.text }]}>
                      ZIP code
                    </Text>
                    <TextInput
                      value={zip}
                      onChangeText={setZip}
                      placeholder="ZIP"
                      placeholderTextColor={palette.muted}
                      keyboardType="number-pad"
                      style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                    />
                  </View>
                  <View style={[styles.inputGroup, styles.inputHalf]}>
                    <Text style={[styles.inputLabel, { color: palette.text }]}>
                      Phone (optional)
                    </Text>
                    <TextInput
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="Phone"
                      placeholderTextColor={palette.muted}
                      keyboardType="phone-pad"
                      style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                    />
                  </View>
                </View>

                {error ? (
                  <Text style={[styles.cardBody, { color: palette.danger }]}
                  >
                    {error}
                  </Text>
                ) : null}

                <Button
                  title={saving ? 'Saving...' : 'Create customer profile'}
                  onPress={handleSubmit}
                  disabled={saving}
                />
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  hero: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  heroGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -120,
    right: -80,
  },
  heroGlowSecondary: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    bottom: -80,
    left: -40,
  },
  heroEyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  heroTitle: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 14,
  },
  formCard: {
    borderRadius: 20,
    padding: 16,
    gap: 16,
    borderWidth: 1,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputHalf: {
    flex: 1,
  },
  inputSmall: {
    width: 90,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardBody: {
    fontSize: 14,
  },
});
