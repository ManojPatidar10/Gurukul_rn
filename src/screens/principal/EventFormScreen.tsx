import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { listClassNames } from '../../api/classSections';
import { createEvent } from '../../api/events';
import type {
  EventCategory,
  EventParticipationType,
  EventRegistrationField,
  EventScope,
} from '../../api/types';
import ClassSectionPicker from '../../components/ClassSectionPicker';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'EventForm'>;

const CATEGORIES: EventCategory[] = ['SPORTS', 'CULTURAL', 'ACADEMIC', 'OTHER'];
const SCOPES: EventScope[] = ['SCHOOL', 'CLASS', 'GRADE'];
const PARTICIPATION_TYPES: { key: EventParticipationType; label: string }[] = [
  { key: 'NONE', label: 'Just an announcement' },
  { key: 'RSVP', label: 'RSVP (attending?)' },
  { key: 'REGISTRATION', label: 'Registration form' },
  { key: 'POLL', label: 'Poll / vote' },
];

function Chip<T extends string>({ value, selected, onPress, label }: { value: T; selected: boolean; onPress: (v: T) => void; label: string }) {
  return (
    <Pressable style={[styles.chip, selected && styles.chipSelected]} onPress={() => onPress(value)}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function EventFormScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState(() => new Date());
  const [showEventDate, setShowEventDate] = useState(false);
  const [category, setCategory] = useState<EventCategory>('OTHER');
  const [scope, setScope] = useState<EventScope>('SCHOOL');
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [classNames, setClassNames] = useState<string[]>([]);
  const [loadingClassNames, setLoadingClassNames] = useState(false);
  const [className, setClassName] = useState<string | null>(null);
  const [venue, setVenue] = useState('');
  const [startAt, setStartAt] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const [endAt, setEndAt] = useState(() => new Date(Date.now() + 2 * 60 * 60 * 1000));
  const [showStartDate, setShowStartDate] = useState(false);
  const [showStartTime, setShowStartTime] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);
  const [showEndTime, setShowEndTime] = useState(false);
  const [participationType, setParticipationType] = useState<EventParticipationType>('NONE');
  const [registrationFields, setRegistrationFields] = useState<EventRegistrationField[]>([]);
  const [fieldLabel, setFieldLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (scope !== 'GRADE') return;
    setLoadingClassNames(true);
    listClassNames(schoolId)
      .then(setClassNames)
      .catch(() => setClassNames([]))
      .finally(() => setLoadingClassNames(false));
  }, [schoolId, scope]);

  const addRegistrationField = () => {
    const label = fieldLabel.trim();
    if (!label) return;
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    setRegistrationFields((prev) => [...prev, { key, label, required: true }]);
    setFieldLabel('');
  };

  const removeRegistrationField = (key: string) => {
    setRegistrationFields((prev) => prev.filter((f) => f.key !== key));
  };

  const canSubmit =
    name.trim().length > 0 &&
    venue.trim().length > 0 &&
    endAt.getTime() > startAt.getTime() &&
    (scope !== 'CLASS' || !!sectionId) &&
    (scope !== 'GRADE' || !!className) &&
    (participationType !== 'REGISTRATION' || registrationFields.length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await createEvent(schoolId, {
        name: name.trim(),
        description: description.trim(),
        eventDate: toDateOnly(eventDate),
        category,
        scope,
        sectionId: scope === 'CLASS' ? sectionId! : undefined,
        className: scope === 'GRADE' ? className! : undefined,
        venue: venue.trim(),
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        participationType,
        registrationFields: participationType === 'REGISTRATION' ? registrationFields : undefined,
      });
      navigation.goBack();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Create event" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <LabeledInput label="Title" value={name} onChangeText={setName} placeholder="e.g. Annual Sports Meet" />
        <LabeledInput
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="What's this event about?"
        />

        <Text style={styles.fieldLabel}>Event date</Text>
        <Pressable style={[styles.dateTimeButton, { marginBottom: spacing.md }]} onPress={() => setShowEventDate(true)}>
          <Text style={styles.dateTimeText}>{eventDate.toLocaleDateString()}</Text>
        </Pressable>
        {showEventDate && (
          <DateTimePicker
            value={eventDate}
            mode="date"
            minimumDate={new Date()}
            onChange={(_, date) => {
              setShowEventDate(false);
              if (date) setEventDate(date);
            }}
          />
        )}

        <LabeledInput label="Venue" value={venue} onChangeText={setVenue} placeholder="e.g. School Ground" />

        <Text style={styles.fieldLabel}>Category</Text>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <Chip key={c} value={c} selected={category === c} onPress={setCategory} label={c} />
          ))}
        </View>

        <Text style={styles.fieldLabel}>Who is this for?</Text>
        <View style={styles.chips}>
          {SCOPES.map((s) => (
            <Chip key={s} value={s} selected={scope === s} onPress={setScope} label={s} />
          ))}
        </View>
        {scope === 'CLASS' && (
          <ClassSectionPicker schoolId={schoolId} selectedId={sectionId} onSelect={(cs) => setSectionId(cs.id)} />
        )}
        {scope === 'GRADE' && (
          <View style={styles.chips}>
            {loadingClassNames ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                {classNames.map((name) => (
                  <Chip key={name} value={name} selected={className === name} onPress={setClassName} label={name} />
                ))}
                {classNames.length === 0 && <Text style={styles.empty}>No classes set up yet.</Text>}
              </>
            )}
          </View>
        )}

        <Text style={styles.fieldLabel}>Starts</Text>
        <View style={styles.dateTimeRow}>
          <Pressable style={styles.dateTimeButton} onPress={() => setShowStartDate(true)}>
            <Text style={styles.dateTimeText}>{startAt.toLocaleDateString()}</Text>
          </Pressable>
          <Pressable style={styles.dateTimeButton} onPress={() => setShowStartTime(true)}>
            <Text style={styles.dateTimeText}>{startAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          </Pressable>
        </View>
        {showStartDate && (
          <DateTimePicker
            value={startAt}
            mode="date"
            minimumDate={new Date()}
            onChange={(_, date) => {
              setShowStartDate(false);
              if (date) {
                const next = new Date(startAt);
                next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                setStartAt(next);
              }
            }}
          />
        )}
        {showStartTime && (
          <DateTimePicker
            value={startAt}
            mode="time"
            onChange={(_, date) => {
              setShowStartTime(false);
              if (date) {
                const next = new Date(startAt);
                next.setHours(date.getHours(), date.getMinutes());
                setStartAt(next);
              }
            }}
          />
        )}

        <Text style={styles.fieldLabel}>Ends</Text>
        <View style={styles.dateTimeRow}>
          <Pressable style={styles.dateTimeButton} onPress={() => setShowEndDate(true)}>
            <Text style={styles.dateTimeText}>{endAt.toLocaleDateString()}</Text>
          </Pressable>
          <Pressable style={styles.dateTimeButton} onPress={() => setShowEndTime(true)}>
            <Text style={styles.dateTimeText}>{endAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          </Pressable>
        </View>
        {showEndDate && (
          <DateTimePicker
            value={endAt}
            mode="date"
            minimumDate={startAt}
            onChange={(_, date) => {
              setShowEndDate(false);
              if (date) {
                const next = new Date(endAt);
                next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                setEndAt(next);
              }
            }}
          />
        )}
        {showEndTime && (
          <DateTimePicker
            value={endAt}
            mode="time"
            onChange={(_, date) => {
              setShowEndTime(false);
              if (date) {
                const next = new Date(endAt);
                next.setHours(date.getHours(), date.getMinutes());
                setEndAt(next);
              }
            }}
          />
        )}

        <Text style={styles.fieldLabel}>Participation</Text>
        <View style={styles.chips}>
          {PARTICIPATION_TYPES.map((p) => (
            <Chip key={p.key} value={p.key} selected={participationType === p.key} onPress={setParticipationType} label={p.label} />
          ))}
        </View>

        {participationType === 'REGISTRATION' && (
          <View style={styles.registrationBuilder}>
            <Text style={styles.registrationHint}>Add the fields participants need to fill in (e.g. Team Name).</Text>
            {registrationFields.map((f) => (
              <View key={f.key} style={styles.registrationFieldRow}>
                <Text style={styles.registrationFieldLabel}>{f.label}</Text>
                <Pressable onPress={() => removeRegistrationField(f.key)}>
                  <Text style={styles.removeField}>Remove</Text>
                </Pressable>
              </View>
            ))}
            <View style={styles.addFieldRow}>
              <View style={styles.addFieldInput}>
                <LabeledInput label="Field label" value={fieldLabel} onChangeText={setFieldLabel} placeholder="e.g. Team Name" />
              </View>
              <Pressable style={styles.addFieldButton} onPress={addRegistrationField} disabled={!fieldLabel.trim()}>
                <Text style={styles.addFieldButtonText}>Add</Text>
              </Pressable>
            </View>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>Create event</Text>}
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
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
  empty: { color: colors.textMuted, fontSize: 13 },
  dateTimeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  dateTimeButton: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  dateTimeText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  registrationBuilder: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  registrationHint: { fontSize: 12.5, color: colors.textMuted, marginBottom: spacing.sm },
  registrationFieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  registrationFieldLabel: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  removeField: { color: colors.error, fontSize: 12.5, fontWeight: '700' },
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
  error: { color: colors.error, marginBottom: spacing.md },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    ...softShadow,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
