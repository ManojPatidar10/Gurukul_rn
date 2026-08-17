import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { createBattleRoom, joinBattleRoom, joinBattleRoomByCode, listBattleRooms, matchBattleRoom } from '../../api/battleRooms';
import type { BattleRoomSummary, Subject } from '../../api/types';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import SubjectPicker from '../../components/SubjectPicker';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, gameColors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'BattleRoomMatch'>;

export function BattleRoomMatchScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [busy, setBusy] = useState<'match' | 'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openRooms, setOpenRooms] = useState<BattleRoomSummary[]>([]);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      listBattleRooms(schoolId, subject?.id)
        .then((rooms) => {
          if (!cancelled) setOpenRooms(rooms);
        })
        .catch(() => {
          if (!cancelled) setOpenRooms([]);
        });
    };
    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [schoolId, subject?.id]);

  const handleJoinRoom = async (roomId: string) => {
    setJoiningRoomId(roomId);
    setError(null);
    try {
      const room = await joinBattleRoom(schoolId, roomId);
      navigation.replace('BattleRoom', { roomId: room.id });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setJoiningRoomId(null);
    }
  };

  const start = async (mode: 'match' | 'create') => {
    if (!subject) return;
    setBusy(mode);
    setError(null);
    try {
      const room =
        mode === 'match'
          ? await matchBattleRoom(schoolId, { subjectId: subject.id })
          : await createBattleRoom(schoolId, { subjectId: subject.id });
      navigation.replace('BattleRoom', { roomId: room.id });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleJoin = async () => {
    const code = roomCode.trim();
    if (!code) return;
    setBusy('join');
    setError(null);
    try {
      const room = await joinBattleRoomByCode(schoolId, code);
      navigation.replace('BattleRoom', { roomId: room.id });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Battle Room" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <Text style={styles.intro}>
          Pick a subject, then quick-match into an open room from your class or create a new one for
          classmates to join.
        </Text>

        <SubjectPicker schoolId={schoolId} selectedId={subject?.id ?? null} onSelect={setSubject} />

        {error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.fieldLabel}>Open battles in your class</Text>
        {openRooms.length === 0 && <Text style={styles.empty}>No open battles right now — start one below.</Text>}
        {openRooms.map((room) => {
          const isWaiting = room.status === 'WAITING';
          return (
            <Pressable
              key={room.id}
              style={[styles.roomRow, !isWaiting && styles.roomRowDisabled]}
              onPress={() => isWaiting && handleJoinRoom(room.id)}
              disabled={!isWaiting || joiningRoomId !== null}
            >
              <View style={styles.roomRowInfo}>
                <Text style={styles.roomRowTitle}>
                  {room.subjectName} · {room.className}
                </Text>
                <Text style={styles.roomRowMeta}>
                  {room.participantCount}/{room.maxPlayers} players · {room.roomCode}
                </Text>
              </View>
              {joiningRoomId === room.id ? (
                <ActivityIndicator color={colors.primary} />
              ) : isWaiting ? (
                <Text style={styles.roomRowJoin}>Join</Text>
              ) : (
                <Text style={styles.roomRowActive}>In progress</Text>
              )}
            </Pressable>
          );
        })}

        <Text style={styles.orDivider}>— or start your own —</Text>

        <Pressable
          style={[styles.actionButton, styles.matchButton, !subject && styles.disabled]}
          onPress={() => start('match')}
          disabled={!subject || busy !== null}
        >
          {busy === 'match' ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <FontAwesome5 name="bolt" size={16} color={colors.white} />
              <Text style={styles.actionButtonText}>Quick Match</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={[styles.actionButton, styles.createButton, !subject && styles.disabled]}
          onPress={() => start('create')}
          disabled={!subject || busy !== null}
        >
          {busy === 'create' ? (
            <ActivityIndicator color={gameColors.ink} />
          ) : (
            <>
              <FontAwesome5 name="plus" size={16} color={gameColors.ink} />
              <Text style={styles.createButtonText}>Create Room</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.orDivider}>— or join a room a classmate created —</Text>

        <LabeledInput
          label="Room Code"
          value={roomCode}
          onChangeText={setRoomCode}
          placeholder="e.g. UZX4VM"
          autoCapitalize="characters"
        />

        <Pressable
          style={[styles.actionButton, styles.joinButton, !roomCode.trim() && styles.disabled]}
          onPress={handleJoin}
          disabled={!roomCode.trim() || busy !== null}
        >
          {busy === 'join' ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <FontAwesome5 name="door-open" size={16} color={colors.white} />
              <Text style={styles.actionButtonText}>Join Room</Text>
            </>
          )}
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  intro: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg },
  error: { color: colors.error, fontSize: 13, marginBottom: spacing.md },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    ...softShadow,
  },
  matchButton: { backgroundColor: gameColors.ember },
  actionButtonText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  createButton: { backgroundColor: gameColors.goldSoft },
  createButtonText: { color: gameColors.ink, fontWeight: '800', fontSize: 15 },
  orDivider: { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginTop: spacing.xl, marginBottom: spacing.md },
  joinButton: { backgroundColor: gameColors.inkSoft },
  disabled: { opacity: 0.5 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  empty: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm },
  roomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  roomRowDisabled: { opacity: 0.6 },
  roomRowInfo: { flex: 1 },
  roomRowTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  roomRowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  roomRowJoin: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  roomRowActive: { color: gameColors.ember, fontWeight: '700', fontSize: 12 },
});
