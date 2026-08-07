import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { getClassSection } from '../../api/classSections';
import {
  addEventPollOptions,
  cancelEvent,
  getEvent,
  getEventPoll,
  listEventRegistrations,
  listEventRsvps,
  submitEventRegistration,
  submitEventRsvp,
  voteEventPoll,
} from '../../api/events';
import type { EventPollResponse, EventRegistrationEntry, EventRsvpEntry, EventRsvpStatus, SchoolEvent } from '../../api/types';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'EventDetail'>;

const RSVP_OPTIONS: { key: EventRsvpStatus; label: string }[] = [
  { key: 'ACCEPTED', label: "I'm attending" },
  { key: 'MAYBE', label: 'Maybe' },
  { key: 'DECLINED', label: "Can't make it" },
];

function statusVariant(status: string | null): 'success' | 'warning' | 'error' | 'neutral' | 'info' {
  switch (status) {
    case 'UPCOMING':
      return 'info';
    case 'ONGOING':
      return 'success';
    case 'CANCELLED':
      return 'error';
    default:
      return 'neutral';
  }
}

const SCOPE_TAG: Record<string, { label: string; color: string }> = {
  SCHOOL: { label: 'School-wide', color: '#0369A1' },
  GRADE: { label: 'Grade', color: '#7C3AED' },
  CLASS: { label: 'Class', color: '#059669' },
};

export function EventDetailScreen({ route, navigation }: Props) {
  const { eventId } = route.params;
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const [event, setEvent] = useState<SchoolEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [poll, setPoll] = useState<EventPollResponse | null>(null);
  const [newOptionLabel, setNewOptionLabel] = useState('');

  const [registrationAnswers, setRegistrationAnswers] = useState<Record<string, string>>({});

  const [rsvps, setRsvps] = useState<EventRsvpEntry[] | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistrationEntry[] | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [classSectionLabel, setClassSectionLabel] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return getEvent(schoolId, eventId)
      .then(setEvent)
      .catch((e) => setError((e as Error).message));
  }, [schoolId, eventId]);

  const loadPoll = useCallback(() => {
    return getEventPoll(schoolId, eventId)
      .then(setPoll)
      .catch(() => setPoll(null));
  }, [schoolId, eventId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (event?.participationType === 'POLL') loadPoll();
  }, [event?.participationType, loadPoll]);

  useEffect(() => {
    if (event?.scope === 'CLASS' && event.sectionId) {
      getClassSection(schoolId, event.sectionId)
        .then((cs) => setClassSectionLabel(`${cs.className} - ${cs.section}`))
        .catch(() => setClassSectionLabel(null));
    }
  }, [schoolId, event?.scope, event?.sectionId]);

  const isCreatorOrAdmin =
    session.role === 'ADMIN' || (event != null && session.ownerType === 'EMPLOYEE' && session.ownerId === event.createdByEmployeeId);

  const handleRsvp = async (status: EventRsvpStatus) => {
    setSubmitting(true);
    setError(null);
    try {
      await submitEventRsvp(schoolId, eventId, { status });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitRegistration = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await submitEventRegistration(schoolId, eventId, { answers: registrationAnswers });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (optionId: string) => {
    setSubmitting(true);
    setError(null);
    try {
      await voteEventPoll(schoolId, eventId, { optionId });
      await loadPoll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddOption = async () => {
    const label = newOptionLabel.trim();
    if (!label) return;
    setSubmitting(true);
    setError(null);
    try {
      await addEventPollOptions(schoolId, eventId, { options: [label] });
      await loadPoll();
      setNewOptionLabel('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    Alert.alert('Cancel event', 'This will mark the event as cancelled. Continue?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel event',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelEvent(schoolId, eventId);
            load();
          } catch (e) {
            setError((e as Error).message);
          }
        },
      },
    ]);
  };

  const loadRoster = () => {
    if (!event) return;
    setRosterLoading(true);
    if (event.participationType === 'RSVP') {
      listEventRsvps(schoolId, eventId)
        .then(setRsvps)
        .catch(() => setRsvps([]))
        .finally(() => setRosterLoading(false));
    } else if (event.participationType === 'REGISTRATION') {
      listEventRegistrations(schoolId, eventId)
        .then(setRegistrations)
        .catch(() => setRegistrations([]))
        .finally(() => setRosterLoading(false));
    }
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Event" onBack={() => navigation.goBack()} />
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Event" onBack={() => navigation.goBack()} />
        <ScreenContainer>
          <Text style={styles.error}>{error ?? 'Could not load this event.'}</Text>
        </ScreenContainer>
      </View>
    );
  }

  const isCancelled = event.participationStatus === 'CANCELLED';

  return (
    <View style={styles.root}>
      <ScreenHeader title={event.name} subtitle={event.category ?? undefined} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <View style={styles.card}>
          {(event.participationStatus || event.scope) && (
            <View style={styles.statusRow}>
              {event.participationStatus && (
                <StatusChip label={event.participationStatus} variant={statusVariant(event.participationStatus)} />
              )}
              {event.scope && (
                <View style={[styles.scopeTag, { backgroundColor: `${SCOPE_TAG[event.scope]?.color}22` }]}>
                  <Text style={[styles.scopeTagText, { color: SCOPE_TAG[event.scope]?.color }]}>
                    {event.scope === 'GRADE' && event.className
                      ? `Grade ${event.className}`
                      : event.scope === 'CLASS' && classSectionLabel
                        ? classSectionLabel
                        : (SCOPE_TAG[event.scope]?.label ?? event.scope)}
                  </Text>
                </View>
              )}
            </View>
          )}
          <Text style={styles.description}>{event.description}</Text>
          {event.venue && <Text style={styles.meta}>📍 {event.venue}</Text>}
          {event.startAt && event.endAt && (
            <Text style={styles.meta}>
              🗓 {new Date(event.startAt).toLocaleString()} — {new Date(event.endAt).toLocaleString()}
            </Text>
          )}
          <Text style={styles.meta}>By {event.createdByEmployeeName}</Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {isCancelled && <Text style={styles.cancelledNote}>This event has been cancelled.</Text>}

        {!isCancelled && event.participationType === 'RSVP' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Will you attend?</Text>
            <View style={styles.chips}>
              {RSVP_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  style={[styles.chip, event.myRsvpStatus === opt.key && styles.chipSelected]}
                  onPress={() => handleRsvp(opt.key)}
                  disabled={submitting}
                >
                  <Text style={[styles.chipText, event.myRsvpStatus === opt.key && styles.chipTextSelected]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {!isCancelled && event.participationType === 'REGISTRATION' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Register to participate</Text>
            {event.myRegistrationAnswers ? (
              <View style={styles.registeredBox}>
                <Text style={styles.registeredNote}>You&apos;re registered:</Text>
                {Object.entries(event.myRegistrationAnswers).map(([key, value]) => (
                  <Text key={key} style={styles.meta}>
                    {key}: {value}
                  </Text>
                ))}
              </View>
            ) : (
              <>
                {(event.registrationFields ?? []).map((f) => (
                  <LabeledInput
                    key={f.key}
                    label={f.label + (f.required ? ' *' : '')}
                    value={registrationAnswers[f.key] ?? ''}
                    onChangeText={(text) => setRegistrationAnswers((prev) => ({ ...prev, [f.key]: text }))}
                  />
                ))}
                <Pressable
                  style={[styles.submit, submitting && styles.submitDisabled]}
                  onPress={handleSubmitRegistration}
                  disabled={submitting}
                >
                  <Text style={styles.submitText}>{submitting ? 'Submitting…' : 'Submit registration'}</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {!isCancelled && event.participationType === 'POLL' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vote</Text>
            {(poll?.options ?? []).map((opt) => (
              <Pressable
                key={opt.id}
                style={[styles.pollOption, poll?.myVoteOptionId === opt.id && styles.pollOptionSelected]}
                onPress={() => handleVote(opt.id)}
                disabled={submitting}
              >
                <Text
                  style={[styles.pollOptionText, poll?.myVoteOptionId === opt.id && styles.pollOptionTextSelected]}
                >
                  {opt.label}
                </Text>
                <Text
                  style={[styles.pollOptionCount, poll?.myVoteOptionId === opt.id && styles.pollOptionTextSelected]}
                >
                  {opt.voteCount}
                </Text>
              </Pressable>
            ))}
            {poll && poll.options.length === 0 && <Text style={styles.meta}>No options added yet.</Text>}

            {isCreatorOrAdmin && (
              <View style={styles.addFieldRow}>
                <View style={styles.addFieldInput}>
                  <LabeledInput label="Add option" value={newOptionLabel} onChangeText={setNewOptionLabel} placeholder="e.g. Design A" />
                </View>
                <Pressable style={styles.addFieldButton} onPress={handleAddOption} disabled={!newOptionLabel.trim() || submitting}>
                  <Text style={styles.addFieldButtonText}>Add</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {isCreatorOrAdmin && (event.participationType === 'RSVP' || event.participationType === 'REGISTRATION') && (
          <View style={styles.section}>
            <Pressable style={styles.rosterButton} onPress={loadRoster}>
              <Text style={styles.rosterButtonText}>{rosterLoading ? 'Loading…' : 'View responses'}</Text>
            </Pressable>
            {event.participationType === 'RSVP' &&
              rsvps?.map((r) => (
                <View key={r.ownerId} style={styles.rosterRow}>
                  <Text style={styles.rosterName}>{r.name}</Text>
                  <Text style={styles.rosterStatus}>{r.status}</Text>
                </View>
              ))}
            {event.participationType === 'REGISTRATION' &&
              registrations?.map((r) => (
                <View key={r.id} style={styles.rosterRow}>
                  <Text style={styles.rosterName}>{r.name}</Text>
                  <Text style={styles.rosterStatus}>{Object.values(r.answers).join(', ')}</Text>
                </View>
              ))}
          </View>
        )}

        {isCreatorOrAdmin && !isCancelled && (
          <Pressable style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelButtonText}>Cancel event</Text>
          </Pressable>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...softShadow,
  },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  scopeTag: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  scopeTagText: { fontSize: 11, fontWeight: '700' },
  description: { fontSize: 14, color: colors.textPrimary, lineHeight: 20, marginBottom: spacing.md },
  meta: { fontSize: 13, color: colors.textMuted, marginBottom: 4 },
  cancelledNote: { color: colors.error, fontWeight: '700', marginBottom: spacing.md },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  chipTextSelected: { color: colors.white },
  registeredBox: { backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, padding: spacing.md },
  registeredNote: { fontSize: 13, fontWeight: '700', color: colors.success, marginBottom: spacing.xs },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...softShadow,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  pollOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  pollOptionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  pollOptionText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  pollOptionCount: { fontSize: 14, fontWeight: '800', color: colors.textMuted },
  pollOptionTextSelected: { color: colors.white },
  addFieldRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  addFieldInput: { flex: 1 },
  addFieldButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  addFieldButtonText: { color: colors.white, fontWeight: '700' },
  rosterButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  rosterButtonText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  rosterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rosterName: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  rosterStatus: { fontSize: 12.5, color: colors.textMuted },
  cancelButton: {
    backgroundColor: '#FFEBEE',
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  cancelButtonText: { color: colors.error, fontWeight: '700' },
});
