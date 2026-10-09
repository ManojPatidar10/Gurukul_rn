import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../../api/errorMessage';
import { createBus, createDriver, listBuses, listDrivers, listTrips, updateBus } from '../../api/transport';
import type { Bus, BusTrip, Driver } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import { formatTime } from '../../transport/labels';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'TransportHub'>;
type Tab = 'trips' | 'buses' | 'drivers';

const STATUS_VARIANT = { CHECKLIST: 'warning', ACTIVE: 'success', ENDED: 'neutral' } as const;

/** Admin: today's bus trips, the school's buses, and its drivers. */
export function TransportHubScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('trips');
  const [trips, setTrips] = useState<BusTrip[] | null>(null);
  const [buses, setBuses] = useState<Bus[] | null>(null);
  const [drivers, setDrivers] = useState<Driver[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Bus form: null = closed, 'new' = adding, else the bus being edited.
  const [editing, setEditing] = useState<Bus | 'new' | null>(null);
  const [busName, setBusName] = useState('');
  const [registration, setRegistration] = useState('');
  const [capacity, setCapacity] = useState('');
  const [defaultDriverId, setDefaultDriverId] = useState<string | null>(null);
  const [busActive, setBusActive] = useState(true);
  const [addingDriver, setAddingDriver] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    return Promise.all([
      listTrips(schoolId).then(setTrips),
      listBuses(schoolId).then(setBuses),
      listDrivers(schoolId).then(setDrivers),
    ])
      .then(() => setError(null))
      .catch((e) => setError(getErrorMessage(e)));
  }, [schoolId]);

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener('focus', () => {
      load();
    });
    return unsubscribe;
  }, [load, navigation]);

  const refresh = () => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  };

  const openBusForm = (bus: Bus | 'new') => {
    setEditing(bus);
    setBusName(bus === 'new' ? '' : bus.name);
    setRegistration(bus === 'new' ? '' : (bus.registrationNumber ?? ''));
    setCapacity(bus === 'new' || bus.capacity == null ? '' : String(bus.capacity));
    setDefaultDriverId(bus === 'new' ? null : bus.defaultDriverId);
    setBusActive(bus === 'new' ? true : bus.active);
  };

  const saveBus = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    const request = {
      name: busName.trim(),
      registrationNumber: registration.trim() || undefined,
      capacity: capacity.trim() ? Number(capacity) : undefined,
      defaultDriverId,
      active: busActive,
    };
    try {
      if (editing === 'new') await createBus(schoolId, request);
      else await updateBus(schoolId, editing.id, request);
      setEditing(null);
      showToast(t('transport.admin.busSaved'), 'success');
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const saveDriver = async () => {
    setSaving(true);
    setError(null);
    try {
      await createDriver(schoolId, { name: driverName.trim(), phone: driverPhone.trim() });
      setAddingDriver(false);
      setDriverName('');
      setDriverPhone('');
      showToast(t('transport.admin.driverSaved'), 'success');
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const busValid = busName.trim() !== '' && (capacity.trim() === '' || Number(capacity) > 0);
  const driverValid = driverName.trim() !== '' && /^\d{10}$/.test(driverPhone.trim());

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('transport.admin.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} keyboardShouldPersistTaps="handled">
        <View style={styles.tabs}>
          {(['trips', 'buses', 'drivers'] as Tab[]).map((key) => (
            <Pressable key={key} style={[styles.tab, tab === key && styles.tabActive]} onPress={() => setTab(key)}>
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{t(`transport.admin.tabs.${key}`)}</Text>
            </Pressable>
          ))}
        </View>
        {error && <ErrorNotice message={error} />}

        {tab === 'trips' && (
          <>
            {trips === null && !error && <ActivityIndicator color={colors.primary} style={styles.loading} />}
            {trips?.length === 0 && <Text style={styles.empty}>{t('transport.admin.noTrips')}</Text>}
            {trips?.map((trip) => {
              const boarded = trip.students.filter((s) => s.status === 'BOARDED').length;
              const notBoarded = trip.students.filter((s) => s.status === 'NOT_BOARDED').length;
              return (
                <Pressable key={trip.id} style={styles.row} onPress={() => navigation.navigate('BusTripDetail', { tripId: trip.id })}>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>
                      {trip.busName} · {t(`transport.direction.${trip.direction}`)}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {[trip.driverName, trip.startedAt ? formatTime(trip.startedAt, i18n.language) : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {t('transport.admin.boardedSummary', { boarded })}
                      {notBoarded > 0 ? ` · ${t('transport.admin.notBoardedSummary', { count: notBoarded })}` : ''}
                    </Text>
                  </View>
                  <StatusChip
                    label={trip.endedAutomatically ? t('transport.admin.endedAuto') : t(`transport.status.${trip.status}`)}
                    variant={trip.endedAutomatically ? 'error' : STATUS_VARIANT[trip.status]}
                  />
                </Pressable>
              );
            })}
          </>
        )}

        {tab === 'buses' && (
          <>
            {editing ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{editing === 'new' ? t('transport.admin.addBus') : t('transport.admin.editBus')}</Text>
                <LabeledInput label={t('transport.admin.busName')} required value={busName} onChangeText={setBusName} placeholder="Bus 1" />
                <LabeledInput
                  label={t('transport.admin.registration')}
                  value={registration}
                  onChangeText={setRegistration}
                  autoCapitalize="characters"
                  placeholder="MP-13-AB-1234"
                />
                <LabeledInput label={t('transport.admin.capacity')} value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
                <Text style={styles.label}>{t('transport.admin.defaultDriver')}</Text>
                <View style={styles.chips}>
                  <Pressable style={[styles.chip, defaultDriverId === null && styles.chipActive]} onPress={() => setDefaultDriverId(null)}>
                    <Text style={[styles.chipText, defaultDriverId === null && styles.chipTextActive]}>{t('common.unassigned')}</Text>
                  </Pressable>
                  {drivers?.map((driver) => (
                    <Pressable
                      key={driver.id}
                      style={[styles.chip, defaultDriverId === driver.id && styles.chipActive]}
                      onPress={() => setDefaultDriverId(driver.id)}
                    >
                      <Text style={[styles.chipText, defaultDriverId === driver.id && styles.chipTextActive]}>{driver.name}</Text>
                    </Pressable>
                  ))}
                </View>
                {editing !== 'new' && (
                  <Pressable style={styles.toggleRow} onPress={() => setBusActive((v) => !v)}>
                    <View style={[styles.checkbox, busActive && styles.checkboxOn]}>{busActive && <Text style={styles.tick}>✓</Text>}</View>
                    <Text style={styles.toggleText}>{t('transport.admin.inService')}</Text>
                  </Pressable>
                )}
                <View style={styles.formButtons}>
                  <Pressable style={styles.secondaryButton} onPress={() => setEditing(null)}>
                    <Text style={styles.secondaryText}>{t('common.cancel')}</Text>
                  </Pressable>
                  <Pressable style={[styles.primaryButton, (!busValid || saving) && styles.disabled]} disabled={!busValid || saving} onPress={saveBus}>
                    <Text style={styles.primaryText}>{saving ? t('common.saving') : t('common.save')}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={styles.addButton} onPress={() => openBusForm('new')}>
                <Text style={styles.addText}>+ {t('transport.admin.addBus')}</Text>
              </Pressable>
            )}
            {buses?.length === 0 && <Text style={styles.empty}>{t('transport.admin.noBuses')}</Text>}
            {buses?.map((bus) => (
              <Pressable key={bus.id} style={styles.row} onPress={() => openBusForm(bus)}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{bus.name}</Text>
                  <Text style={styles.rowMeta}>
                    {[bus.registrationNumber, bus.capacity ? t('transport.admin.seats', { count: bus.capacity }) : null, bus.defaultDriverName]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                {!bus.active && <StatusChip label={t('transport.admin.outOfService')} variant="warning" />}
              </Pressable>
            ))}
          </>
        )}

        {tab === 'drivers' && (
          <>
            {addingDriver ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('transport.admin.addDriver')}</Text>
                <LabeledInput label={t('transport.admin.driverName')} required value={driverName} onChangeText={setDriverName} />
                <LabeledInput
                  label={t('transport.admin.driverPhone')}
                  required
                  value={driverPhone}
                  onChangeText={setDriverPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
                <Text style={styles.hint}>{t('transport.admin.driverLoginHint')}</Text>
                <View style={styles.formButtons}>
                  <Pressable style={styles.secondaryButton} onPress={() => setAddingDriver(false)}>
                    <Text style={styles.secondaryText}>{t('common.cancel')}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.primaryButton, (!driverValid || saving) && styles.disabled]}
                    disabled={!driverValid || saving}
                    onPress={saveDriver}
                  >
                    <Text style={styles.primaryText}>{saving ? t('common.saving') : t('common.save')}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={styles.addButton} onPress={() => setAddingDriver(true)}>
                <Text style={styles.addText}>+ {t('transport.admin.addDriver')}</Text>
              </Pressable>
            )}
            {drivers?.length === 0 && <Text style={styles.empty}>{t('transport.admin.noDrivers')}</Text>}
            {drivers?.map((driver) => (
              <View key={driver.id} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{driver.name}</Text>
                  <Text style={styles.rowMeta}>{driver.phone}</Text>
                </View>
              </View>
            ))}
            <Text style={styles.hint}>{t('transport.admin.removeDriverHint')}</Text>
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
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontWeight: '700', color: colors.textSecondary },
  tabTextActive: { color: colors.white },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowMain: { flex: 1, marginRight: spacing.sm },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontWeight: '700', color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  checkboxOn: { backgroundColor: colors.primary },
  tick: { color: colors.white, fontWeight: '900' },
  toggleText: { fontSize: 15, color: colors.textPrimary },
  hint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
  formButtons: { flexDirection: 'row', gap: spacing.sm },
  secondaryButton: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: 'center' },
  secondaryText: { color: colors.textSecondary, fontWeight: '800' },
  primaryButton: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.white, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  addButton: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
});
