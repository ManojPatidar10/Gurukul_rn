import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getBattleRoom } from '../../api/battleRooms';
import { sendBattleAnswer, sendBuzz, subscribeToBattleRoom } from '../../api/battleRoomSocket';
import type { BattleRoomState, QuizOption } from '../../api/types';
import { CircularCountdown } from '../../components/CircularCountdown';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, gameColors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'BattleRoom'>;

const OPTIONS: { key: QuizOption; field: 'optionA' | 'optionB' | 'optionC' | 'optionD' }[] = [
  { key: 'A', field: 'optionA' },
  { key: 'B', field: 'optionB' },
  { key: 'C', field: 'optionC' },
  { key: 'D', field: 'optionD' },
];

export function BattleRoomScreen({ route, navigation }: Props) {
  const { roomId } = route.params;
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const [room, setRoom] = useState<BattleRoomState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const countdownStartedForRoomId = useRef<string | null>(null);
  // The backend doesn't send a room start timestamp, so a countdown is only trustworthy for
  // whoever was present when the room had just 1 participant (i.e. the creator/first arrival) -
  // for them, "when I first observed WAITING" genuinely is the start time. Anyone joining after
  // that has already missed an unknown chunk of the window, so showing them a countdown that
  // restarts from the full duration would just be wrong, not merely imprecise.
  const isLikelyCreatorForRoomId = useRef<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    getBattleRoom(schoolId, roomId)
      .then((state) => {
        if (!cancelled) setRoom(state);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));

    subscribeToBattleRoom(session.token, schoolId, roomId, setRoom)
      .then((unsub) => {
        unsubscribe = unsub;
      })
      .catch((e) => setError((e as Error).message));

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [schoolId, roomId, session.token]);

  useEffect(() => {
    if (!room) return;
    if (isLikelyCreatorForRoomId.current !== null) return;
    isLikelyCreatorForRoomId.current = room.participants.length <= 1 ? room.id : 'not-' + room.id;
  }, [room]);

  const isLikelyCreator = !!room && isLikelyCreatorForRoomId.current === room.id;

  useEffect(() => {
    if (!room || room.status !== 'WAITING' || !isLikelyCreator) {
      countdownStartedForRoomId.current = null;
      return;
    }
    if (countdownStartedForRoomId.current === room.id) return;
    countdownStartedForRoomId.current = room.id;
    setRemainingSeconds(room.joinWindowSeconds);

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [room?.id, room?.status, room?.joinWindowSeconds, isLikelyCreator]);

  const myStudentId = session.ownerId;
  const iWonBuzz = room?.currentBuzzWinnerStudentId === myStudentId;
  const someoneElseBuzzed = !!room?.currentBuzzWinnerStudentId && !iWonBuzz;
  const buzzWinnerName = room?.participants.find((p) => p.studentId === room.currentBuzzWinnerStudentId)?.name;

  const handleBuzz = () => sendBuzz(session.token, schoolId, roomId);
  const handleAnswer = (option: QuizOption) => sendBattleAnswer(session.token, schoolId, roomId, option);

  if (loading) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Battle Room" onBack={() => navigation.goBack()} />
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      </View>
    );
  }

  if (error || !room) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Battle Room" onBack={() => navigation.goBack()} />
        <ScreenContainer>
          <Text style={styles.error}>{error ?? 'Room not found.'}</Text>
        </ScreenContainer>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title={`${room.subjectName} Battle`} subtitle={room.className} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {room.status === 'WAITING' && (
          <View style={styles.card}>
            {isLikelyCreator ? (
              <CircularCountdown
                totalSeconds={room.joinWindowSeconds}
                remainingSeconds={remainingSeconds}
                color={gameColors.gold}
                trackColor={colors.border}
              />
            ) : (
              <ActivityIndicator color={gameColors.gold} size="large" />
            )}
            <Text style={styles.waitingTitle}>Waiting for players…</Text>
            <Text style={styles.waitingSubtitle}>
              {room.participants.length}/{room.maxPlayers} joined · needs {room.minPlayers} to start
            </Text>
            <View style={styles.roomCodeChip}>
              <Text style={styles.roomCodeLabel}>Room code — share to invite</Text>
              <Text style={styles.roomCodeValue} selectable>
                {room.roomCode}
              </Text>
            </View>
            {room.participants.map((p) => (
              <Text key={p.studentId} style={styles.participantRow}>
                {p.name}
              </Text>
            ))}
          </View>
        )}

        {room.status === 'ACTIVE' && room.currentQuestion && (
          <View style={styles.card}>
            <Text style={styles.questionIndex}>
              Question {room.currentQuestionIndex + 1} of {room.questionCount}
            </Text>
            <Text style={styles.questionText}>{room.currentQuestion.questionText}</Text>

            {room.lastAnswerCorrect !== null && (
              <Text style={room.lastAnswerCorrect ? styles.resultCorrect : styles.resultWrong}>
                {room.lastAnswerCorrect ? '✅ Correct!' : '❌ Not quite.'}
              </Text>
            )}

            {!room.currentBuzzWinnerStudentId ? (
              <Pressable style={styles.buzzButton} onPress={handleBuzz}>
                <Text style={styles.buzzButtonText}>BUZZ IN</Text>
              </Pressable>
            ) : iWonBuzz ? (
              <View style={styles.optionsList}>
                {OPTIONS.map(({ key, field }) => (
                  <Pressable key={key} style={styles.optionButton} onPress={() => handleAnswer(key)}>
                    <Text style={styles.optionKey}>{key}</Text>
                    <Text style={styles.optionText}>{room.currentQuestion![field]}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              someoneElseBuzzed && <Text style={styles.buzzWinnerText}>{buzzWinnerName} is answering…</Text>
            )}

            <View style={styles.scoreList}>
              {room.participants.map((p) => (
                <Text key={p.studentId} style={styles.scoreRow}>
                  {p.name}: {p.correctCount}
                </Text>
              ))}
            </View>
          </View>
        )}

        {room.status === 'COMPLETED' && (
          <View style={styles.card}>
            <FontAwesome5 name="trophy" size={28} color={gameColors.gold} />
            <Text style={styles.waitingTitle}>{room.winnerName ?? 'Battle'} wins!</Text>
            {[...room.participants]
              .sort((a, b) => b.correctCount - a.correctCount)
              .map((p) => (
                <Text key={p.studentId} style={styles.participantRow}>
                  {p.name} — {p.correctCount} correct
                </Text>
              ))}
          </View>
        )}

        {room.status === 'CANCELLED' && (
          <View style={styles.card}>
            <Text style={styles.waitingTitle}>Room cancelled</Text>
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, fontSize: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    ...softShadow,
  },
  waitingTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.sm },
  waitingSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md },
  roomCodeChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  roomCodeLabel: { fontSize: 11, color: colors.textMuted },
  roomCodeValue: { fontSize: 13, color: colors.textPrimary, fontWeight: '700', marginTop: 2 },
  participantRow: { fontSize: 14, color: colors.textPrimary, paddingVertical: spacing.xs },
  questionIndex: { fontSize: 12, color: colors.textMuted, alignSelf: 'flex-start' },
  questionText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  resultCorrect: { color: colors.success, fontWeight: '700', marginBottom: spacing.md },
  resultWrong: { color: colors.error, fontWeight: '700', marginBottom: spacing.md },
  buzzButton: {
    width: '100%',
    backgroundColor: gameColors.ember,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  buzzButtonText: { color: colors.white, fontWeight: '800', fontSize: 20, letterSpacing: 1 },
  buzzWinnerText: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic', paddingVertical: spacing.md },
  optionsList: { width: '100%', gap: spacing.sm },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  optionKey: { fontWeight: '800', color: gameColors.ember, width: 20 },
  optionText: { color: colors.textPrimary, fontSize: 14, flex: 1 },
  scoreList: { width: '100%', marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  scoreRow: { fontSize: 13, color: colors.textMuted, paddingVertical: 2 },
});
