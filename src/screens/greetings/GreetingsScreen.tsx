import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../../api/errorMessage';
import {
  cancelGreeting,
  createGreeting,
  getGreetingSettings,
  getGreetingSuggestions,
  getUpcomingBirthdays,
  listGreetings,
  sendGreetingNow,
  sendGreetingTest,
  updateGreetingSettings,
} from '../../api/greetings';
import type {
  Greeting,
  GreetingAudience,
  GreetingKind,
  GreetingSettings,
  GreetingSuggestion,
  UpcomingBirthday,
} from '../../api/types';
import ClassSectionPicker from '../../components/ClassSectionPicker';
import { DatePickerField } from '../../components/DatePickerField';
import { ErrorNotice } from '../../components/ErrorNotice';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Greetings'>;
type Tab = 'upcoming' | 'birthdays' | 'sent';

const AUDIENCES: GreetingAudience[] = ['EVERYONE', 'FAMILIES', 'STAFF', 'GRADE', 'SECTION'];
const STATUS_VARIANT = { SCHEDULED: 'info', SENT: 'success', CANCELLED: 'neutral', MISSED: 'warning' } as const;

interface Draft {
  kind: GreetingKind;
  key: string | null;
  title: string;
  message: string;
  sendDate: string;
  audience: GreetingAudience;
  className: string | null;
  sectionId: string | null;
  sectionLabel: string | null;
  eventId: string | null;
}

function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/**
 * Admin: festival / event greetings (scheduled, sent as an app notification on the day, around
 * 8 AM) and birthday wishes (switched on per school; app notification plus WhatsApp).
 */
export function GreetingsScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [upcoming, setUpcoming] = useState<Greeting[] | null>(null);
  const [sent, setSent] = useState<Greeting[] | null>(null);
  const [suggestions, setSuggestions] = useState<GreetingSuggestion[]>([]);
  const [birthdays, setBirthdays] = useState<UpcomingBirthday[] | null>(null);
  const [settings, setSettings] = useState<GreetingSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    return Promise.all([
      listGreetings(schoolId, 'upcoming').then(setUpcoming),
      listGreetings(schoolId, 'past').then(setSent),
      getGreetingSuggestions(schoolId).then(setSuggestions),
      getUpcomingBirthdays(schoolId, 7).then(setBirthdays),
      getGreetingSettings(schoolId).then(setSettings),
    ])
      .then(() => setError(null))
      .catch((e) => setError(getErrorMessage(e)));
  }, [schoolId]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  };

  const dateLabel = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' });

  const audienceLabel = (g: { audience: GreetingAudience; className?: string | null; sectionLabel?: string | null }) =>
    g.audience === 'GRADE'
      ? t('greetings.audience.GRADE_named', { name: g.className ?? '' })
      : g.audience === 'SECTION'
        ? t('greetings.audience.SECTION_named', { name: g.sectionLabel ?? '' })
        : t(`greetings.audience.${g.audience}`);

  const startFrom = (suggestion: GreetingSuggestion | null) => {
    setPicking(false);
    setDraft(
      suggestion
        ? {
            kind: suggestion.kind,
            key: suggestion.key,
            title: suggestion.title,
            message: suggestion.message,
            sendDate: suggestion.suggestedDate ?? '',
            audience: suggestion.audience,
            className: suggestion.className,
            sectionId: suggestion.sectionId,
            sectionLabel: null,
            eventId: suggestion.eventId,
          }
        : {
            kind: 'CUSTOM',
            key: null,
            title: '',
            message: '',
            sendDate: todayIso(),
            audience: 'EVERYONE',
            className: null,
            sectionId: null,
            sectionLabel: null,
            eventId: null,
          }
    );
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      await createGreeting(schoolId, {
        kind: draft.kind,
        title: draft.title.trim(),
        message: draft.message.trim(),
        sendDate: draft.sendDate,
        audience: draft.audience,
        className: draft.audience === 'GRADE' ? draft.className : null,
        sectionId: draft.audience === 'SECTION' ? draft.sectionId : null,
        eventId: draft.kind === 'EVENT' ? draft.eventId : null,
        festivalKey: draft.kind === 'FESTIVAL' ? draft.key : null,
      });
      setDraft(null);
      showToast(t('greetings.scheduled'), 'success');
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const act = async (id: string, action: () => Promise<unknown>, done: string) => {
    setBusyId(id);
    setError(null);
    try {
      await action();
      showToast(done, 'success');
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const confirm = (title: string, body: string, onYes: () => void) =>
    Alert.alert(title, body, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: title, style: 'destructive', onPress: onYes },
    ]);

  const saveSettings = async (next: GreetingSettings) => {
    setSettings(next);
    try {
      setSettings(await updateGreetingSettings(schoolId, next));
    } catch (e) {
      setError(getErrorMessage(e));
      load();
    }
  };

  const draftValid =
    !!draft &&
    draft.title.trim() !== '' &&
    draft.message.trim() !== '' &&
    draft.sendDate !== '' &&
    (draft.audience !== 'GRADE' || !!draft.className) &&
    (draft.audience !== 'SECTION' || !!draft.sectionId);

  const renderGreeting = (g: Greeting, actions: boolean) => (
    <View key={g.id} style={styles.row}>
      <View style={styles.rowTop}>
        <View style={styles.rowMain}>
          <Text style={styles.rowTitle}>{g.title}</Text>
          <Text style={styles.rowMeta}>
            {dateLabel(g.sendDate)} · {audienceLabel(g)}
            {g.recipientCount != null ? ` · ${t('greetings.sentTo', { count: g.recipientCount })}` : ''}
          </Text>
        </View>
        <StatusChip label={t(`greetings.status.${g.status}`)} variant={STATUS_VARIANT[g.status]} />
      </View>
      <Text style={styles.message} numberOfLines={3}>
        {g.message}
      </Text>
      {actions && g.status === 'SCHEDULED' && (
        <View style={styles.actions}>
          {busyId === g.id ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Pressable onPress={() => act(g.id, () => sendGreetingTest(schoolId, g.id), t('greetings.testSent'))}>
                <Text style={styles.action}>{t('greetings.sendTest')}</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  confirm(t('greetings.sendNow'), t('greetings.sendNowBody', { audience: audienceLabel(g) }), () =>
                    act(g.id, () => sendGreetingNow(schoolId, g.id), t('greetings.sentToast'))
                  )
                }
              >
                <Text style={styles.action}>{t('greetings.sendNow')}</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  confirm(t('greetings.cancel'), t('greetings.cancelBody'), () =>
                    act(g.id, () => cancelGreeting(schoolId, g.id), t('greetings.cancelled'))
                  )
                }
              >
                <Text style={[styles.action, styles.danger]}>{t('greetings.cancel')}</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );

  const festivals = suggestions.filter((s) => s.kind === 'FESTIVAL');
  const events = suggestions.filter((s) => s.kind === 'EVENT');

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('greetings.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} keyboardShouldPersistTaps="handled">
        <View style={styles.tabs}>
          {(['upcoming', 'birthdays', 'sent'] as Tab[]).map((key) => (
            <Pressable key={key} style={[styles.tab, tab === key && styles.tabActive]} onPress={() => setTab(key)}>
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{t(`greetings.tabs.${key}`)}</Text>
            </Pressable>
          ))}
        </View>
        {error && <ErrorNotice message={error} />}

        {tab === 'upcoming' && (
          <>
            {!draft && !picking && (
              <Pressable style={styles.addButton} onPress={() => setPicking(true)}>
                <Text style={styles.addText}>+ {t('greetings.new')}</Text>
              </Pressable>
            )}
            <Text style={styles.hint}>{t('greetings.appOnlyHint')}</Text>

            {picking && (
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>{t('greetings.pickTitle')}</Text>
                  <Pressable onPress={() => setPicking(false)}>
                    <Text style={styles.action}>{t('common.cancel')}</Text>
                  </Pressable>
                </View>
                <Pressable style={styles.pick} onPress={() => startFrom(null)}>
                  <Text style={styles.pickTitle}>✏️ {t('greetings.custom')}</Text>
                </Pressable>
                {events.length > 0 && <Text style={styles.label}>{t('greetings.events')}</Text>}
                {events.map((s) => (
                  <Pressable key={s.key} style={styles.pick} onPress={() => startFrom(s)}>
                    <Text style={styles.pickTitle}>📅 {s.title}</Text>
                    <Text style={styles.pickMeta}>
                      {s.suggestedDate ? dateLabel(s.suggestedDate) : ''}
                      {s.alreadyScheduled ? ` · ${t('greetings.alreadyScheduled')}` : ''}
                    </Text>
                  </Pressable>
                ))}
                <Text style={styles.label}>{t('greetings.festivals')}</Text>
                <View style={styles.chips}>
                  {festivals.map((s) => (
                    <Pressable key={s.key} style={[styles.chip, s.alreadyScheduled && styles.chipDone]} onPress={() => startFrom(s)}>
                      <Text style={styles.chipText}>
                        {s.alreadyScheduled ? '✓ ' : ''}
                        {s.title}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {draft && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('greetings.newTitle')}</Text>
                <LabeledInput
                  label={t('greetings.form.title')}
                  required
                  value={draft.title}
                  onChangeText={(title) => setDraft({ ...draft, title })}
                  maxLength={120}
                />
                <Text style={styles.label}>{t('greetings.form.message')} *</Text>
                <TextInput
                  style={styles.messageInput}
                  value={draft.message}
                  onChangeText={(message) => setDraft({ ...draft, message })}
                  multiline
                  maxLength={1000}
                  placeholderTextColor={colors.textMuted}
                />
                <DatePickerField
                  label={t('greetings.form.date')}
                  value={draft.sendDate}
                  onChange={(sendDate) => setDraft({ ...draft, sendDate })}
                  minimumDate={new Date(`${todayIso()}T00:00:00`)}
                  placeholder={t('greetings.form.pickDate')}
                />
                {draft.kind === 'FESTIVAL' && <Text style={styles.hint}>{t('greetings.form.checkDate')}</Text>}
                <Text style={styles.label}>{t('greetings.form.audience')}</Text>
                <View style={styles.chips}>
                  {AUDIENCES.map((a) => (
                    <Pressable
                      key={a}
                      style={[styles.chip, draft.audience === a && styles.chipActive]}
                      onPress={() => setDraft({ ...draft, audience: a })}
                    >
                      <Text style={[styles.chipText, draft.audience === a && styles.chipTextActive]}>
                        {t(`greetings.audience.${a}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {(draft.audience === 'GRADE' || draft.audience === 'SECTION') && (
                  <ClassSectionPicker
                    schoolId={schoolId}
                    selectedId={draft.sectionId}
                    onSelect={(section) =>
                      setDraft({
                        ...draft,
                        sectionId: section.id,
                        className: section.className,
                        sectionLabel: `${section.className} ${section.section}`,
                      })
                    }
                  />
                )}
                {draft.audience === 'GRADE' && draft.className && (
                  <Text style={styles.hint}>{t('greetings.form.gradeHint', { name: draft.className })}</Text>
                )}
                <View style={styles.formButtons}>
                  <Pressable style={styles.secondaryButton} onPress={() => setDraft(null)}>
                    <Text style={styles.secondaryText}>{t('common.cancel')}</Text>
                  </Pressable>
                  <Pressable style={[styles.primaryButton, (!draftValid || saving) && styles.disabled]} disabled={!draftValid || saving} onPress={save}>
                    <Text style={styles.primaryText}>{saving ? t('common.saving') : t('greetings.schedule')}</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {upcoming === null && !error && <ActivityIndicator color={colors.primary} style={styles.loading} />}
            {upcoming?.length === 0 && !draft && !picking && <Text style={styles.empty}>{t('greetings.noneUpcoming')}</Text>}
            {upcoming?.map((g) => renderGreeting(g, true))}
          </>
        )}

        {tab === 'birthdays' && (
          <>
            {settings && (
              <View style={styles.card}>
                <View style={styles.switchRow}>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>{t('greetings.birthdays.enabled')}</Text>
                    <Text style={styles.rowMeta}>{t('greetings.birthdays.enabledHint')}</Text>
                  </View>
                  <Switch
                    value={settings.birthdaysEnabled}
                    onValueChange={(birthdaysEnabled) => saveSettings({ ...settings, birthdaysEnabled })}
                    trackColor={{ true: colors.primary, false: colors.border }}
                  />
                </View>
                <View style={[styles.switchRow, !settings.birthdaysEnabled && styles.disabled]}>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>{t('greetings.birthdays.whatsapp')}</Text>
                    <Text style={styles.rowMeta}>{t('greetings.birthdays.whatsappHint')}</Text>
                  </View>
                  <Switch
                    value={settings.birthdayWhatsApp}
                    disabled={!settings.birthdaysEnabled}
                    onValueChange={(birthdayWhatsApp) => saveSettings({ ...settings, birthdayWhatsApp })}
                    trackColor={{ true: colors.primary, false: colors.border }}
                  />
                </View>
              </View>
            )}
            <Text style={styles.sectionTitle}>{t('greetings.birthdays.next7')}</Text>
            {birthdays === null && !error && <ActivityIndicator color={colors.primary} style={styles.loading} />}
            {birthdays?.length === 0 && <Text style={styles.empty}>{t('greetings.birthdays.none')}</Text>}
            {birthdays?.map((b, index) => {
              const newDay = index === 0 || birthdays[index - 1].date !== b.date;
              const isToday = b.date === todayIso();
              return (
                <View key={`${b.ownerType}:${b.id}`}>
                  {newDay && (
                    <Text style={styles.day}>{isToday ? t('greetings.birthdays.today') : dateLabel(b.date)}</Text>
                  )}
                  <View style={styles.birthday}>
                    <Text style={styles.cake}>🎂</Text>
                    <View style={styles.rowMain}>
                      <Text style={styles.rowTitle}>{b.name}</Text>
                      <Text style={styles.rowMeta}>
                        {b.ownerType === 'EMPLOYEE' ? t('greetings.birthdays.staff') : t('greetings.birthdays.student')}
                        {b.detail ? ` · ${b.detail}` : ''}
                        {!b.hasPhone ? ` · ${t('greetings.birthdays.noPhone')}` : ''}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
            <Text style={styles.hint}>{t('greetings.birthdays.staffHint')}</Text>
          </>
        )}

        {tab === 'sent' && (
          <>
            {sent === null && !error && <ActivityIndicator color={colors.primary} style={styles.loading} />}
            {sent?.length === 0 && <Text style={styles.empty}>{t('greetings.noneSent')}</Text>}
            {sent?.map((g) => renderGreeting(g, false))}
          </>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  empty: { color: colors.textMuted, textAlign: 'center', marginVertical: spacing.lg },
  hint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontWeight: '700', color: colors.textSecondary },
  tabTextActive: { color: colors.white },
  addButton: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  addText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, ...softShadow },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pick: { paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pickTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  pickMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  chipActive: { backgroundColor: colors.primary },
  chipDone: { backgroundColor: '#E8F5E9' },
  chipText: { fontWeight: '700', color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  messageInput: {
    minHeight: 120,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    fontSize: 15,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  formButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  secondaryButton: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: 'center' },
  secondaryText: { color: colors.textSecondary, fontWeight: '800' },
  primaryButton: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.white, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  row: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, ...softShadow },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start' },
  rowMain: { flex: 1, marginRight: spacing.sm },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  message: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md, alignItems: 'center' },
  action: { color: colors.primary, fontWeight: '800' },
  danger: { color: colors.error },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginVertical: spacing.sm },
  day: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.sm },
  birthday: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  cake: { fontSize: 26, marginRight: spacing.md },
});
