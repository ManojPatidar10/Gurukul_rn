import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../../api/errorMessage';
import { createRoom, deactivateRoom, listRooms, updateRoom, type Room } from '../../api/rooms';
import { ErrorNotice } from '../../components/ErrorNotice';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import {
  ROOM_NAME_MAX,
  roomFormToRequest,
  roomToForm,
  splitRooms,
  validateRoomForm,
  type RoomForm,
  type RoomFormError,
} from '../../utils/rooms';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Rooms'>;

/** The room being added (room null) or edited. */
interface Editing {
  room: Room | null;
  form: RoomForm;
}

const accent = accents.rooms;

/**
 * The school's classrooms and labs (admin, Academics section). A room goes on timetable periods
 * so two classes can't be put in it at once. Rooms are never deleted: "Stop using this room" takes
 * one out of use - it stays on the periods that have it but can't be picked again - and the In use
 * switch puts it back.
 */
export function RoomsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const sheetBottom = useBottomInset(spacing.lg);
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    () =>
      listRooms(schoolId, true)
        .then((rows) => {
          setRooms(rows);
          setError(null);
        })
        .catch((e) => setError(getErrorMessage(e))),
    [schoolId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  };

  const formErrorText = (code: RoomFormError) =>
    code === 'nameTooLong' ? t('timetable.rooms.nameTooLong', { max: ROOM_NAME_MAX }) : t(`timetable.rooms.${code}`);

  const open = (room: Room | null) => {
    setEditing({ room, form: roomToForm(room) });
    setFormError(null);
  };

  const close = () => {
    if (!saving) setEditing(null);
  };

  const save = async () => {
    if (!editing) return;
    const problem = validateRoomForm(editing.form);
    if (problem) {
      setFormError(formErrorText(problem));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const request = roomFormToRequest(editing.form, !editing.room);
      if (editing.room) await updateRoom(schoolId, editing.room.id, request);
      else await createRoom(schoolId, request);
      setEditing(null);
      showToast(t('timetable.rooms.saved'), 'success');
      await load();
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = (room: Room) =>
    Alert.alert(t('timetable.rooms.removeTitle', { name: room.name }), t('timetable.rooms.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('timetable.rooms.remove'),
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await deactivateRoom(schoolId, room.id);
            setEditing(null);
            showToast(t('timetable.rooms.removed'), 'success');
            await load();
          } catch (e) {
            setFormError(getErrorMessage(e));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);

  const { active, inactive } = splitRooms(rooms ?? []);

  const row = (room: Room) => (
    <Pressable key={room.id} style={styles.row} onPress={() => open(room)} accessibilityRole="button">
      <View style={[styles.iconCircle, { backgroundColor: accent.light }]}>
        <FontAwesome5 name="door-open" size={16} color={accent.base} />
      </View>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>{room.name}</Text>
        {room.capacity != null && (
          <Text style={styles.rowMeta}>{t('timetable.rooms.seats', { count: room.capacity })}</Text>
        )}
      </View>
      <StatusChip
        label={room.active ? t('timetable.rooms.active') : t('timetable.rooms.inactive')}
        variant={room.active ? 'success' : 'neutral'}
      />
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('timetable.rooms.title')} subtitle={t('timetable.rooms.subtitle')} onBack={() => navigation.goBack()} />
      <ScreenContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {error && <ErrorNotice message={error} />}
        <Pressable style={styles.addButton} onPress={() => open(null)}>
          <Text style={styles.addText}>{t('timetable.rooms.add')}</Text>
        </Pressable>
        {rooms === null && !error && <ActivityIndicator color={colors.primary} style={styles.loading} />}
        {rooms?.length === 0 && <Text style={styles.empty}>{t('timetable.rooms.empty')}</Text>}
        {active.length > 0 && <Text style={styles.sectionTitle}>{t('timetable.rooms.active')}</Text>}
        {active.map(row)}
        {inactive.length > 0 && <Text style={styles.sectionTitle}>{t('timetable.rooms.inactive')}</Text>}
        {inactive.map(row)}
      </ScreenContainer>

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={[styles.sheet, { paddingBottom: sheetBottom }]} onPress={() => {}}>
            {editing && (
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.sheetTitle}>{editing.room ? t('timetable.rooms.edit') : t('timetable.rooms.newTitle')}</Text>
                <LabeledInput
                  label={t('timetable.rooms.name')}
                  required
                  value={editing.form.name}
                  onChangeText={(name) => setEditing({ ...editing, form: { ...editing.form, name } })}
                  maxLength={ROOM_NAME_MAX}
                />
                <LabeledInput
                  label={t('timetable.rooms.capacity')}
                  value={editing.form.capacity}
                  onChangeText={(capacity) => setEditing({ ...editing, form: { ...editing.form, capacity } })}
                  keyboardType="number-pad"
                  maxLength={4}
                />
                {editing.room && (
                  <View style={styles.switchRow}>
                    <Text style={styles.switchText}>{t('timetable.rooms.active')}</Text>
                    <Switch
                      value={editing.form.active}
                      onValueChange={(on) => setEditing({ ...editing, form: { ...editing.form, active: on } })}
                      trackColor={{ true: colors.primary, false: colors.border }}
                    />
                  </View>
                )}
                {formError && <ErrorNotice message={formError} />}
                <View style={styles.formButtons}>
                  <Pressable style={styles.secondaryButton} onPress={close}>
                    <Text style={styles.secondaryText}>{t('common.cancel')}</Text>
                  </Pressable>
                  <Pressable style={[styles.primaryButton, saving && styles.disabled]} disabled={saving} onPress={save}>
                    {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>{t('timetable.rooms.save')}</Text>}
                  </Pressable>
                </View>
                {editing.room?.active && (
                  <Pressable style={styles.removeButton} onPress={() => editing.room && confirmRemove(editing.room)} disabled={saving}>
                    <Text style={styles.removeText}>{t('timetable.rooms.remove')}</Text>
                  </Pressable>
                )}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  empty: { color: colors.textMuted, textAlign: 'center', marginVertical: spacing.lg, lineHeight: 20 },
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
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  iconCircle: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  rowMain: { flex: 1, marginRight: spacing.sm },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  switchText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  formButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  secondaryButton: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: 'center' },
  secondaryText: { color: colors.textSecondary, fontWeight: '800' },
  primaryButton: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.white, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  removeButton: { alignItems: 'center', paddingTop: spacing.md },
  removeText: { color: colors.error, fontWeight: '800' },
});
