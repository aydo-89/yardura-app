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
import type { CustomerSetupResponse, CustomerSummary } from '@/lib/api/types';

export default function CustomerAddressScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [phone, setPhone] = useState('');

  const loadAddress = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const [setupResult, summaryResult] = await Promise.allSettled([
        apiRequest<CustomerSetupResponse>('/api/mobile/customer/setup', { token: session.token }),
        apiRequest<CustomerSummary>('/api/mobile/customer/summary', { token: session.token }),
      ]);
      const setup = setupResult.status === 'fulfilled' ? setupResult.value : null;
      const summary = summaryResult.status === 'fulfilled' ? summaryResult.value : null;
      setName(setup?.setup.name ?? summary?.customer.name ?? '');
      setAddressLine1(setup?.setup.addressLine1 ?? '');
      setCity(summary?.customer.city ?? setup?.setup.city ?? '');
      setState(summary?.customer.state ?? setup?.setup.state ?? '');
      setZip(summary?.customer.zip ?? setup?.setup.zip ?? '');
      setPhone(summary?.contact?.phone ?? '');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load address.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    loadAddress();
  }, [loadAddress]);

  const handleSave = useCallback(async () => {
    if (!session?.token || saving) return;
    if (!name.trim() || !addressLine1.trim() || !city.trim() || !state.trim() || !zip.trim()) {
      setError('Please complete all required fields.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
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
      setSaved(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save address.';
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [addressLine1, city, name, phone, saving, session?.token, state, zip]);

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: palette.text }]}>Service address</Text>
            <Button title="Back" variant="ghost" onPress={() => router.back()} />
          </View>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Add your home address to power the yard map, weather alerts, and service scheduling.
          </Text>

          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            {loading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator size="small" color={palette.tint} />
                <Text style={[styles.helperText, { color: palette.muted }]}>Loading address...</Text>
              </View>
            ) : (
              <>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: palette.text }]}>Full name</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Full name"
                    placeholderTextColor={palette.muted}
                    style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: palette.text }]}>Address</Text>
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
                    <Text style={[styles.inputLabel, { color: palette.text }]}>City</Text>
                    <TextInput
                      value={city}
                      onChangeText={setCity}
                      placeholder="City"
                      placeholderTextColor={palette.muted}
                      style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                    />
                  </View>
                  <View style={[styles.inputGroup, styles.inputSmall]}>
                    <Text style={[styles.inputLabel, { color: palette.text }]}>State</Text>
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
                    <Text style={[styles.inputLabel, { color: palette.text }]}>ZIP code</Text>
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
                    <Text style={[styles.inputLabel, { color: palette.text }]}>Phone (optional)</Text>
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
                <Button
                  title={saving ? 'Saving...' : 'Save address'}
                  onPress={handleSave}
                  disabled={saving}
                />
                {saved ? (
                  <Text style={[styles.successText, { color: palette.tint }]}>
                    Address saved. Your yard map will update shortly.
                  </Text>
                ) : null}
              </>
            )}
            {error ? (
              <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
            ) : null}
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
  scroll: {
    padding: 20,
    paddingBottom: 40,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginTop: 8,
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
    gap: 10,
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
  helperText: {
    fontSize: 12,
  },
  errorText: {
    fontSize: 12,
  },
  successText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
