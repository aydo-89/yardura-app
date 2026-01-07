import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { useAuth } from '@/lib/auth/AuthProvider';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      setError('Enter your email and password to continue.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const nextSession = await signIn(email.trim(), password);
      if (nextSession.activeRole === 'TECH') {
        router.replace('/(app)/(scooper)');
      } else if (nextSession.activeRole === 'SALES_REP') {
        router.replace('/(app)/(sales)');
      } else {
        router.replace('/(app)/(customer)');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed.';
      setError(message);
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
          <Text style={[styles.subtitle, { color: palette.muted }]}
          >
            Sign in to manage visits, wellness, and offers.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
        >
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

          <Text style={[styles.label, { color: palette.text }]}>Password</Text>
          <View style={[styles.passwordRow, { borderColor: palette.border }]}>
            <TextInput
              secureTextEntry={!showPassword}
              placeholder="********"
              placeholderTextColor={palette.muted}
              style={[styles.passwordInput, { color: palette.text }]}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable onPress={() => setShowPassword((prev) => !prev)}>
              <Text style={[styles.toggleText, { color: palette.tint }]}>
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            </Pressable>
          </View>

          <Pressable onPress={() => router.push('/(auth)/forgot-password')}>
            <Text style={[styles.link, { color: palette.tint }]}>Forgot password?</Text>
          </Pressable>

          {error ? (
            <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>
          ) : null}

          <Button
            title={submitting ? 'Signing in...' : 'Sign in'}
            onPress={handleSignIn}
            disabled={submitting}
          />
          {submitting ? (
            <ActivityIndicator style={styles.spinner} color={palette.tint} />
          ) : null}
          <Pressable onPress={() => router.push('/(auth)/sign-up' as any)}>
            <Text style={[styles.link, { color: palette.tint }]}>
              New here? Create an account
            </Text>
          </Pressable>
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
  passwordRow: {
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    fontSize: 13,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    alignSelf: 'center',
  },
  spinner: {
    marginTop: 12,
  },
});
