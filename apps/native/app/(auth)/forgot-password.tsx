import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
} from 'react-native';
import { router } from 'expo-router';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { APP_NAME } from '@/lib/config';
import { apiRequest } from '@/lib/api/client';

type ForgotPasswordResponse = {
  message?: string;
};

export default function ForgotPasswordScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email) {
      setError('Enter your email to receive a reset link.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await apiRequest<ForgotPasswordResponse>(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          body: { email: email.trim() },
        },
      );
      setMessage(
        response?.message ??
          'If an account exists, we sent a password reset link.',
      );
    } catch (err) {
      const nextMessage =
        err instanceof Error ? err.message : 'Unable to send reset link.';
      setError(nextMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen padded={false}>
        <View style={styles.hero}>
          <Image 
            source={require('../../assets/images/logo-stacked.png')} 
            style={styles.logo} 
            resizeMode="contain"
          />
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Enter your email to get a password reset link.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.label, { color: palette.text }]}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@email.com"
            placeholderTextColor={palette.muted}
            style={[styles.input, { color: palette.text, borderColor: palette.border }]}
            value={email}
            onChangeText={setEmail}
          />

          {message ? (
            <Text style={[styles.message, { color: palette.tint }]}>{message}</Text>
          ) : null}

          {error ? (
            <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>
          ) : null}

          <Button
            title={submitting ? 'Sending...' : 'Send reset link'}
            onPress={handleSubmit}
            disabled={submitting}
          />
          {submitting ? (
            <ActivityIndicator style={styles.spinner} color={palette.tint} />
          ) : null}

          <Button
            title="Back to sign in"
            onPress={() => router.replace('/(auth)/sign-in')}
            variant="ghost"
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 32,
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    maxWidth: 280,
    height: 120,
    marginBottom: 24,
    alignSelf: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    width: '100%',
  },
  card: {
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
  },
  message: {
    fontSize: 13,
  },
  error: {
    fontSize: 13,
  },
  spinner: {
    marginTop: 12,
  },
});
