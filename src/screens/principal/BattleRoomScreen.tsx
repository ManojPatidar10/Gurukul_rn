import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { getBattleRoom } from '../../api/battleRooms';
import { sendBattleAnswer, sendBuzz, subscribeToBattleRoom } from '../../api/battleRoomSocket';
import { serverNow } from '../../api/client';
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
  const [showFeedback, setShowFeedback] = useState(false);
  const prevQuestionIndexRef = useRef<number | undefined>(undefined);
  const questionFade = useRef(new Animated.Value(1)).current;

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
    if (!room || room.status !== 'WAITING') return;

    const tick = () => {
      const secondsLeft = (new Date(room.joinWindowEndsAt).getTime() - serverNow()) / 1000;
      setRemainingSeconds(Math.max(0, secondsLeft));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [room?.status, room?.joinWindowEndsAt]);

  // The backend's lastAnswerCorrect flag doesn't say which question it was for, and can still be
  // set to the previous result even after currentQuestionIndex has already advanced. If the index
  // just changed, that result belongs to the question we're leaving - never show it for the new
  // one. Also fades the question card so moving to the next question reads as a clear transition
  // instead of the text just silently swapping.
  useEffect(() => {
    if (!room) return;
    const indexChanged =
      prevQuestionIndexRef.current !== undefined && prevQuestionIndexRef.current !== room.currentQuestionIndex;
    prevQuestionIndexRef.current = room.currentQuestionIndex;

    if (indexChanged) {
      setShowFeedback(false);
      questionFade.setValue(0);
      Animated.timing(questionFade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      return;
    }

    if (room.lastAnswerCorrect !== null) {
      setShowFeedback(true);
      const timeout = setTimeout(() => setShowFeedback(false), 2200);
      return () => clearTimeout(timeout);
    }
  }, [room?.currentQuestionIndex, room?.lastAnswerCorrect, questionFade]);

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
            <CircularCountdown
              totalSeconds={room.joinWindowSeconds}
              remainingSeconds={remainingSeconds}
              color={gameColors.gold}
              trackColor={colors.border}
            />
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

        {room.status === 'ACTIVE' && (
          <>
            <View style={styles.table}>
              {room.participants.map((p) => {
                const isMe = p.studentId === myStudentId;
                const hasBuzz = p.studentId === room.currentBuzzWinnerStudentId;
                return (
                  <View key={p.studentId} style={[styles.seat, hasBuzz && styles.seatBuzzed]}>
                    <View style={[styles.seatAvatar, hasBuzz && styles.seatAvatarBuzzed]}>
                      <Text style={styles.seatAvatarText}>{p.name.trim().charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.seatName} numberOfLines={1}>
                      {isMe ? 'You' : p.name}
                    </Text>
                    <Text style={styles.seatScore}>{p.correctCount} pts</Text>
                    {hasBuzz && <Text style={styles.seatBuzzLabel}>BUZZED</Text>}
                  </View>
                );
              })}
            </View>

            {room.currentQuestion ? (
              <Animated.View style={[styles.card, { opacity: questionFade }]}>
                <Text style={styles.questionIndex}>
                  Question {room.currentQuestionIndex + 1} of {room.questionCount}
                </Text>
                <Text style={styles.questionText}>{room.currentQuestion.questionText}</Text>

                {showFeedback && room.lastAnswerCorrect !== null && (
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
              </Animated.View>
            ) : (
              <View style={styles.card}>
                <ActivityIndicator color={gameColors.ember} />
                <Text style={styles.waitingTitle}>Get ready…</Text>
                <Text style={styles.waitingSubtitle}>Next question is on its way.</Text>
              </View>
            )}
          </>
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
  table: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  seat: {
    flexGrow: 1,
    minWidth: 90,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  seatBuzzed: { borderColor: gameColors.ember, backgroundColor: '#FFF1EC' },
  seatAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  seatAvatarBuzzed: { backgroundColor: gameColors.ember },
  seatAvatarText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  seatName: { fontSize: 12.5, fontWeight: '700', color: colors.textPrimary, maxWidth: 84 },
  seatScore: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  seatBuzzLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: gameColors.ember,
    letterSpacing: 0.5,
    marginTop: 2,
  },
});
