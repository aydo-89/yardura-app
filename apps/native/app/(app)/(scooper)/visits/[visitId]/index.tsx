import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useVisitFlow } from '@/lib/scooper/visitFlow';
import { parseDateInput } from '@/lib/dates';

function formatDate(value?: string | null) {
  if (!value) return 'Scheduled soon';
  const date = parseDateInput(value);
  if (Number.isNaN(date.getTime())) return 'Scheduled soon';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function VisitOverviewScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const {
    visit,
    visitId,
    loading,
    error,
    steps,
    canAccessStep,
    isStepComplete,
    nextRequiredStep,
    isScheduledToday,
  } = useVisitFlow();

  if (loading && !visit) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.tint} />
          <Text style={[styles.muted, { color: palette.muted }]}>Loading visit...</Text>
        </View>
      </Screen>
    );
  }

  if (error && !visit) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>
          <Button title="Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </Screen>
    );
  }

  const customerName = visit?.customer?.name ?? 'Customer';
  const address = visit?.customer?.addressLine1 ?? 'Address on file';
  const city = visit?.customer?.city ? `, ${visit.customer.city}` : '';
  const scheduleLabel = formatDate(visit?.scheduledDate);
  const visitLockedByDate = Boolean(visit) && !isScheduledToday;

  const nextRequiredLabel = steps.find((step) => step.id === nextRequiredStep)?.label;

  const handleOpenStep = (stepId: string) => {
    if (visitLockedByDate) return;
    router.push(`/(app)/(scooper)/visits/${visitId}/${stepId}`);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.pageHeader}>
          <Text style={[styles.kicker, { color: palette.muted }]}>Visit overview</Text>
          <Text style={[styles.title, { color: palette.text }]}>Visit steps</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Follow each step in order to complete the visit.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>{customerName}</Text>
          <Text style={[styles.cardBody, { color: palette.muted }]}>{scheduleLabel}</Text>
          <Text style={[styles.cardBody, { color: palette.muted }]}>
            {address}
            {city}
          </Text>
        </View>

        {visitLockedByDate ? (
          <View
            style={[
              styles.noticeCard,
              { backgroundColor: palette.background, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.noticeTitle, { color: palette.text }]}>Visit locked</Text>
            <Text style={[styles.noticeBody, { color: palette.muted }]}>
              This visit is scheduled for {scheduleLabel}. You can open it on the scheduled day.
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          {steps.map((step, index) => {
            const completed = isStepComplete(step.id);
            const accessible = canAccessStep(step.id);
            const isCurrent = nextRequiredStep === step.id;
            const statusLabel = completed
              ? 'Completed'
              : accessible
                ? 'Next up'
                : 'Locked';
            return (
              <View
                key={step.id}
                style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <View style={styles.rowBetween}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>
                    Step {index + 1}: {step.label}
                  </Text>
                  <Text
                    style={[
                      styles.stepStatus,
                      { color: completed ? palette.tint : accessible ? palette.text : palette.muted },
                    ]}
                  >
                    {statusLabel}
                  </Text>
                </View>
                <Text style={[styles.cardBody, { color: palette.muted }]}>{step.description}</Text>
                {visitLockedByDate ? (
                  <Text style={[styles.lockedText, { color: palette.muted }]}>
                    Available on {scheduleLabel}.
                  </Text>
                ) : !accessible ? (
                  <Text style={[styles.lockedText, { color: palette.muted }]}>
                    Finish {nextRequiredLabel ?? 'the previous step'} to unlock.
                  </Text>
                ) : null}
                <View style={styles.actionRow}>
                  <Button
                    title={completed ? 'Review step' : isCurrent ? 'Continue' : 'Open step'}
                    onPress={() => handleOpenStep(step.id)}
                    disabled={!accessible || visitLockedByDate}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {nextRequiredStep ? (
          <Button
            title={`Continue: ${steps.find((step) => step.id === nextRequiredStep)?.label ?? 'Next step'}`}
            onPress={() => handleOpenStep(nextRequiredStep)}
            disabled={visitLockedByDate}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  pageHeader: {
    marginTop: 8,
    marginBottom: 18,
    gap: 6,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  stepStatus: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  lockedText: {
    fontSize: 12,
    marginTop: 6,
  },
  actionRow: {
    marginTop: 12,
    alignItems: 'flex-start',
  },
  noticeCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  noticeBody: {
    fontSize: 12,
    lineHeight: 18,
  },
  section: {
    marginBottom: 20,
  },
  muted: {
    fontSize: 14,
  },
  error: {
    fontSize: 14,
    textAlign: 'center',
  },
});
