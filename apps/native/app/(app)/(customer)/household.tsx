import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';

type HouseholdMemberRole = 'FAMILY_MEMBER' | 'DOG_SITTER' | 'DOG_WALKER' | 'HOUSE_SITTER' | 'EMERGENCY_CONTACT';
type HouseholdMemberStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'REVOKED';

interface HouseholdMember {
  id: string;
  name: string;
  email: string;
  role: HouseholdMemberRole;
  roleLabel: string;
  status: HouseholdMemberStatus;
  expiresAt: string | null;
  isExpired: boolean;
  lastAccessAt: string | null;
  createdAt: string;
}

const ROLE_OPTIONS: Array<{ value: HouseholdMemberRole; label: string; description: string }> = [
  { value: 'FAMILY_MEMBER', label: 'Family', description: 'Lives in household' },
  { value: 'DOG_SITTER', label: 'Dog Sitter', description: 'Temporary caretaker' },
  { value: 'DOG_WALKER', label: 'Dog Walker', description: 'Regular walker' },
  { value: 'HOUSE_SITTER', label: 'House Sitter', description: 'While you\'re away' },
  { value: 'EMERGENCY_CONTACT', label: 'Emergency', description: 'View-only access' },
];

const STATUS_BADGES: Record<HouseholdMemberStatus, { label: string; color: string }> = {
  PENDING: { label: 'Invite sent', color: Colors.brand.gold },
  ACTIVE: { label: 'Active', color: Colors.brand.mint },
  EXPIRED: { label: 'Expired', color: '#94A3B8' },
  REVOKED: { label: 'Removed', color: '#EF4444' },
};

export default function HouseholdScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;

  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<HouseholdMemberRole>('FAMILY_MEMBER');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const heroBackground = colorScheme === 'light' ? Colors.brand.graphite : '#1E293B';

  const loadMembers = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ ok: boolean; members: HouseholdMember[]; error?: string }>(
        '/api/mobile/customer/household',
        { token: session.token },
      );
      if (res.ok) {
        setMembers(res.members);
      } else {
        setError(res.error ?? 'Failed to load members');
      }
    } catch (err) {
      setError('Failed to load household members');
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleInvite = async () => {
    if (!session?.token) return;
    if (!inviteName.trim() || !inviteEmail.trim()) {
      setInviteError('Name and email are required');
      return;
    }
    setInviting(true);
    setInviteError(null);
    try {
      const res = await apiRequest<{ ok: boolean; member?: HouseholdMember; error?: string }>(
        '/api/mobile/customer/household',
        {
          method: 'POST',
          token: session.token,
          body: {
            name: inviteName.trim(),
            email: inviteEmail.trim().toLowerCase(),
            role: inviteRole,
          },
        },
      );
      if (res.ok && res.member) {
        setMembers((prev) => [res.member!, ...prev]);
        setShowInviteModal(false);
        setInviteName('');
        setInviteEmail('');
        setInviteRole('FAMILY_MEMBER');
        Alert.alert('Invite sent', `${inviteName} will receive an email to join your household.`);
      } else {
        setInviteError(res.error ?? 'Failed to send invite');
      }
    } catch (err) {
      setInviteError('Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (member: HouseholdMember) => {
    if (!session?.token) return;
    Alert.alert(
      'Remove access',
      `Remove ${member.name} from your household? They will no longer be able to view your pet information.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await apiRequest<{ ok: boolean; error?: string }>(
                `/api/mobile/customer/household/${member.id}`,
                { method: 'DELETE', token: session.token },
              );
              if (res.ok) {
                setMembers((prev) =>
                  prev.map((m) => (m.id === member.id ? { ...m, status: 'REVOKED' as const } : m)),
                );
              } else {
                Alert.alert('Error', res.error ?? 'Failed to remove member');
              }
            } catch (err) {
              Alert.alert('Error', 'Failed to remove member');
            }
          },
        },
      ],
    );
  };

  const activeMembers = members.filter((m) => m.status === 'ACTIVE' || m.status === 'PENDING');
  const inactiveMembers = members.filter((m) => m.status === 'EXPIRED' || m.status === 'REVOKED');

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Hero header */}
        <View style={[styles.hero, { backgroundColor: heroBackground }]}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.push('/(app)/(customer)/account' as Href)}
          >
            <FontAwesome name="chevron-left" size={16} color="rgba(255,255,255,0.7)" />
          </Pressable>
          <Text style={[styles.heroEyebrow, { color: 'rgba(255,255,255,0.65)' }]}>Settings</Text>
          <Text style={styles.heroTitle}>Household access</Text>
          <Text style={[styles.heroSubtitle, { color: 'rgba(255,255,255,0.7)' }]}>
            Invite family members, dog sitters, or other caregivers to view your pet information.
          </Text>
        </View>

        {/* Invite button */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: cardBorder }]}>
          <Button
            title="Invite someone"
            onPress={() => setShowInviteModal(true)}
            variant="primary"
          />
        </View>

        {/* Loading/Error states */}
        {loading && (
          <View style={styles.centeredMessage}>
            <ActivityIndicator color={palette.tint} />
            <Text style={[styles.messageText, { color: palette.muted }]}>Loading...</Text>
          </View>
        )}

        {error && (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: cardBorder }]}>
            <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
          </View>
        )}

        {/* Active members */}
        {!loading && activeMembers.length > 0 && (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Active members</Text>
            {activeMembers.map((member) => {
              const statusBadge = STATUS_BADGES[member.status];
              return (
                <View
                  key={member.id}
                  style={[styles.memberRow, { borderBottomColor: cardBorder }]}
                >
                  <View style={[styles.memberAvatar, { backgroundColor: `${palette.accent}15` }]}>
                    <FontAwesome name="user" size={16} color={palette.accent} />
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: palette.text }]}>{member.name}</Text>
                    <Text style={[styles.memberEmail, { color: palette.muted }]}>{member.email}</Text>
                    <View style={styles.memberMeta}>
                      <View style={[styles.badge, { backgroundColor: `${statusBadge.color}15` }]}>
                        <Text style={[styles.badgeText, { color: statusBadge.color }]}>
                          {statusBadge.label}
                        </Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: `${palette.tint}15` }]}>
                        <Text style={[styles.badgeText, { color: palette.tint }]}>
                          {member.roleLabel}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Pressable onPress={() => handleRemove(member)} style={styles.removeButton}>
                    <FontAwesome name="times" size={16} color={palette.danger} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {/* Empty state */}
        {!loading && activeMembers.length === 0 && !error && (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: cardBorder }]}>
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: `${palette.accent}15` }]}>
                <FontAwesome name="users" size={24} color={palette.accent} />
              </View>
              <Text style={[styles.emptyTitle, { color: palette.text }]}>No household members yet</Text>
              <Text style={[styles.emptyText, { color: palette.muted }]}>
                Invite family members or dog sitters to give them access to your pet information.
              </Text>
            </View>
          </View>
        )}

        {/* Inactive members */}
        {!loading && inactiveMembers.length > 0 && (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: palette.muted }]}>Past members</Text>
            {inactiveMembers.map((member) => {
              const statusBadge = STATUS_BADGES[member.status];
              return (
                <View
                  key={member.id}
                  style={[styles.memberRow, styles.memberRowInactive, { borderBottomColor: cardBorder }]}
                >
                  <View style={[styles.memberAvatar, { backgroundColor: `${palette.muted}15` }]}>
                    <FontAwesome name="user" size={16} color={palette.muted} />
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: palette.muted }]}>{member.name}</Text>
                    <Text style={[styles.memberEmail, { color: palette.muted }]}>{member.email}</Text>
                    <View style={[styles.badge, { backgroundColor: `${statusBadge.color}15` }]}>
                      <Text style={[styles.badgeText, { color: statusBadge.color }]}>
                        {statusBadge.label}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Invite Modal */}
      <Modal visible={showInviteModal} transparent animationType="slide" onRequestClose={() => setShowInviteModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowInviteModal(false)}>
          <View style={[styles.modalContent, { backgroundColor: palette.card }]}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHandle}>
                <View style={[styles.handle, { backgroundColor: palette.border }]} />
              </View>
              <Text style={[styles.modalTitle, { color: palette.text }]}>Invite someone</Text>
              <Text style={[styles.modalSubtitle, { color: palette.muted }]}>
                They'll receive an email to join your household.
              </Text>

              <TextInput
                style={[styles.input, { borderColor: cardBorder, color: palette.text }]}
                placeholder="Name"
                placeholderTextColor={palette.muted}
                value={inviteName}
                onChangeText={setInviteName}
                autoCapitalize="words"
              />
              <TextInput
                style={[styles.input, { borderColor: cardBorder, color: palette.text }]}
                placeholder="Email address"
                placeholderTextColor={palette.muted}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={[styles.inputLabel, { color: palette.muted }]}>Role</Text>
              <View style={styles.roleChips}>
                {ROLE_OPTIONS.map((option) => (
                  <ChoiceChip
                    key={option.value}
                    label={option.label}
                    selected={inviteRole === option.value}
                    onPress={() => setInviteRole(option.value)}
                  />
                ))}
              </View>

              {inviteError && (
                <Text style={[styles.errorText, { color: palette.danger }]}>{inviteError}</Text>
              )}

              <Button
                title={inviting ? 'Sending...' : 'Send invite'}
                onPress={handleInvite}
                disabled={inviting || !inviteName.trim() || !inviteEmail.trim()}
                variant="primary"
                style={styles.inviteButton}
              />
              <Pressable onPress={() => setShowInviteModal(false)} style={styles.cancelLink}>
                <Text style={[styles.cancelText, { color: palette.muted }]}>Cancel</Text>
              </Pressable>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  hero: {
    borderRadius: 24,
    padding: 20,
    paddingTop: 44,
    overflow: 'hidden',
    marginBottom: 18,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
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
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  centeredMessage: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  messageText: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 13,
    marginTop: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  memberRowInactive: {
    opacity: 0.6,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
  },
  memberEmail: {
    fontSize: 13,
  },
  memberMeta: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  removeButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalHandle: {
    alignItems: 'center',
    marginBottom: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  roleChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  inviteButton: {
    marginTop: 8,
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
