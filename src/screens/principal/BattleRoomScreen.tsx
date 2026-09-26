import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getBattleRoom, startBattleRoom } from '../../api/battleRooms';
import { sendBattleAnswer, subscribeToBattleRoom } from '../../api/battleRoomSocket';
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
  const [now, setNow] = useState(() => serverNow());
  const [hasAnsweredCurrent, setHasAnsweredCurrent] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

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

  // A student can only answer once per question, but the server's next state doesn't arrive
  // instantly - lock the options as soon as they tap one rather than waiting for the round trip.
  useEffect(() => {
    setHasAnsweredCurrent(false);
  }, [room?.currentQuestionIndex]);

  const startsAt = room?.currentQuestionStartsAt ? new Date(room.currentQuestionStartsAt).getTime() : null;
  const endsAt = room?.currentQuestionEndsAt ? new Date(room.currentQuestionEndsAt).getTime() : null;
  const inRevealPause = startsAt !== null && startsAt > now;

  // Ticks every 250ms whenever there's a live countdown to track (the reveal pause before a
  // question opens, or the answer window while one is live) so both count down smoothly.
  useEffect(() => {
    if (!room || room.status !== 'ACTIVE') return;
    const interval = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(interval);
  }, [room?.status, room?.currentQuestionIndex]);

  const myStudentId = session.ownerId;
  const me = room?.participants.find((p) => p.studentId === myStudentId);
  const myAnswered = hasAnsweredCurrent || me?.answeredCurrentQuestion === true;

  const handleAnswer = (option: QuizOption) => {
    setHasAnsweredCurrent(true);
    sendBattleAnswer(session.token, schoolId, roomId, option);
  };

  const handleStartNow = async () => {
    setStarting(true);
    setStartError(null);
    try {
      const updated = await startBattleRoom(schoolId, roomId);
      setRoom(updated);
    } catch (e) {
      // "no longer waiting" just means someone else already started it (or the window expired) -
      // the STOMP subscription is already about to push that same state, nothing to show the user.
      const message = (e as Error).message;
      if (!message.includes('no longer waiting')) setStartError(message);
    } finally {
      setStarting(false);
    }
  };

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

            {room.participants.length >= room.minPlayers && (
              <Pressable style={styles.startNowButton} onPress={handleStartNow} disabled={starting}>
                {starting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.startNowButtonText}>Start now</Text>
                )}
              </Pressable>
            )}
            {startError && <Text style={styles.startError}>{startError}</Text>}
          </View>
        )}

        {room.status === 'ACTIVE' && (
          <>
            <View style={styles.table}>
              {room.participants.map((p) => {
                const isMe = p.studentId === myStudentId;
                return (
                  <View key={p.studentId} style={[styles.seat, p.answeredCurrentQuestion && styles.seatAnswered]}>
                    <View style={[styles.seatAvatar, p.answeredCurrentQuestion && styles.seatAvatarAnswered]}>
                      <Text style={styles.seatAvatarText}>{p.name.trim().charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.seatName} numberOfLines={1}>
                      {isMe ? 'You' : p.name}
                    </Text>
                    <Text style={styles.seatScore}>{p.points} pts</Text>
                    {p.answeredCurrentQuestion && <Text style={styles.seatAnsweredLabel}>LOCKED IN</Text>}
                  </View>
                );
              })}
            </View>

            {inRevealPause && room.lastResult ? (
              <View style={styles.card}>
                <Text style={styles.revealTitle}>Correct answer: {room.lastResult.correctOption}</Text>
                {room.lastResult.results.map((r) => (
                  <View key={r.studentId} style={styles.revealRow}>
                    <Text style={styles.revealName} numberOfLines={1}>
                      {r.studentId === myStudentId ? 'You' : r.name}
                    </Text>
                    <View
                      style={[
                        styles.revealChip,
                        !r.answered
                          ? styles.revealChipNeutral
                          : r.correct
                            ? styles.revealChipCorrect
                            : styles.revealChipWrong,
                      ]}
                    >
                      <Text style={styles.revealChipText}>{r.answered ? r.selectedOption : '—'}</Text>
                    </View>
                    <Text style={styles.revealPoints}>+{r.points}</Text>
                  </View>
                ))}
                <Text style={styles.waitingSubtitle}>
                  Next question in {Math.max(0, Math.ceil(((startsAt ?? now) - now) / 1000))}…
                </Text>
              </View>
            ) : room.currentQuestion ? (
              <View style={styles.card}>
                <View style={styles.questionHeaderRow}>
                  <Text style={styles.questionIndex}>
                    Question {room.currentQuestionIndex + 1} of {room.questionCount}
                  </Text>
                  {endsAt !== null && (
                    <CircularCountdown
                      totalSeconds={10}
                      remainingSeconds={Math.max(0, (endsAt - now) / 1000)}
                      size={32}
                      strokeWidth={4}
                      color={gameColors.ember}
                      trackColor={colors.border}
                    />
                  )}
                </View>
                <Text style={styles.questionText}>{room.currentQuestion.questionText}</Text>

                <View style={styles.optionsList}>
                  {OPTIONS.map(({ key, field }) => (
                    <Pressable
                      key={key}
                      style={[styles.optionButton, myAnswered && styles.optionButtonDisabled]}
                      onPress={() => handleAnswer(key)}
                      disabled={myAnswered}
                    >
                      <Text style={styles.optionKey}>{key}</Text>
                      <Text style={styles.optionText}>{room.currentQuestion![field]}</Text>
                    </Pressable>
                  ))}
                </View>
                {myAnswered && <Text style={styles.buzzWinnerText}>Waiting for others…</Text>}
              </View>
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
            {room.participants.map((p) => (
              <Text key={p.studentId} style={styles.participantRow}>
                {p.name} — {p.points} pts ({p.correctCount} correct)
              </Text>
            ))}
            {room.lastResult && (
              <View style={[styles.card, styles.finalResultCard]}>
                <Text style={styles.revealTitle}>
                  Final question — correct answer: {room.lastResult.correctOption}
                </Text>
                {room.lastResult.results.map((r) => (
                  <View key={r.studentId} style={styles.revealRow}>
                    <Text style={styles.revealName} numberOfLines={1}>
                      {r.studentId === myStudentId ? 'You' : r.name}
                    </Text>
                    <View
                      style={[
                        styles.revealChip,
                        !r.answered
                          ? styles.revealChipNeutral
                          : r.correct
                            ? styles.revealChipCorrect
                            : styles.revealChipWrong,
                      ]}
                    >
                      <Text style={styles.revealChipText}>{r.answered ? r.selectedOption : '—'}</Text>
                    </View>
                    <Text style={styles.revealPoints}>+{r.points}</Text>
                  </View>
                ))}
              </View>
            )}
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
  startNowButton: {
    width: '100%',
    backgroundColor: gameColors.jade,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
    ...softShadow,
  },
  startNowButtonText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  startError: { color: colors.error, fontSize: 12.5, marginTop: spacing.sm, textAlign: 'center' },
  questionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  questionIndex: { fontSize: 12, color: colors.textMuted },
  questionText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  revealTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md },
  revealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  revealName: { flex: 1, fontSize: 14, color: colors.textPrimary },
  revealChip: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealChipNeutral: { backgroundColor: colors.surfaceMuted },
  revealChipCorrect: { backgroundColor: colors.success },
  revealChipWrong: { backgroundColor: colors.error },
  revealChipText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  revealPoints: { fontSize: 13, fontWeight: '700', color: colors.textMuted, width: 36, textAlign: 'right' },
  finalResultCard: { width: '100%', marginTop: spacing.md, ...softShadow },
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
  optionButtonDisabled: { opacity: 0.5 },
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
  seatAnswered: { borderColor: gameColors.jade, backgroundColor: '#EAFBF3' },
  seatAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  seatAvatarAnswered: { backgroundColor: gameColors.jade },
  seatAvatarText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  seatName: { fontSize: 12.5, fontWeight: '700', color: colors.textPrimary, maxWidth: 84 },
  seatScore: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  seatAnsweredLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: gameColors.jade,
    letterSpacing: 0.5,
    marginTop: 2,
  },
});
