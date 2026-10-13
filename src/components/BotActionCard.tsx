import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { BotAction } from '../api/types';
import { colors, radius, spacing } from '../theme/colors';
import {
  botActionCardState,
  botActionChipLabel,
  botActionChipVariant,
  botActionExpiresIn,
  botActionFailureText,
  botActionInlineError,
  botActionNotes,
  botActionTitle,
  formatBotActionItem,
  type BotActionViewer,
} from '../utils/botActions';
import { StatusChip } from './StatusChip';

/** How often a waiting card's "Expires in N min" is redrawn. */
const TICK_MS = 30_000;

interface BotActionCardProps {
  action: BotAction;
  /** The signed-in user: only the admin who asked gets Confirm and Cancel. */
  viewer: BotActionViewer;
  /** When this state of the card reached the phone, to correct the phone's clock with `serverTime`. */
  receivedAtMs: number;
  /** The button whose request is running, if any; both buttons are disabled meanwhile. */
  busy: 'confirm' | 'cancel' | null;
  /** The last confirm or cancel error for this card, shown under it while it still waits. */
  error: string | null;
  onConfirm: (action: BotAction) => void;
  onCancel: (action: BotAction) => void;
}

/**
 * A timetable proposal from the helpdesk bot, under the bot's message: what will change (built by
 * the server from checked data), its status on every device, and - for the admin who asked, while
 * it's waiting - Confirm and Cancel. Nothing is saved until Confirm.
 */
export function BotActionCard({ action, viewer, receivedAtMs, busy, error, onConfirm, onCancel }: BotActionCardProps) {
  const { t, i18n } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  const state = botActionCardState(action, viewer, now, receivedAtMs);

  // Redraws the countdown every 30 s, and exactly when the card runs out, so the buttons go away on
  // time even between ticks.
  const waiting = state.status === 'PENDING' && Number.isFinite(state.msLeft);
  const msLeft = state.msLeft;
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(TICK_MS, msLeft + 50));
    return () => clearTimeout(timer);
  }, [waiting, msLeft]);

  const notes = botActionNotes(action, t);
  const failure = botActionFailureText(action, t);
  const expiresIn = botActionExpiresIn(state, t);
  const inlineError = botActionInlineError(state, error);
  const isBusy = busy !== null;
  const confirmLabel = t('helpdeskBot.card.confirm');
  const cancelLabel = t('helpdeskBot.card.cancel');

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{botActionTitle(action, t)}</Text>
        <StatusChip label={botActionChipLabel(state, t)} variant={botActionChipVariant(state.chip)} />
      </View>
      {(action.items ?? []).map((item) => {
        const line = formatBotActionItem(item, t, i18n.language);
        return (
          <View key={`${item.index}-${item.sectionId}-${item.periodNumber}`} style={styles.item}>
            <Text selectable style={styles.itemText}>
              {`${item.index}. ${line.text}`}
            </Text>
            {line.room ? <Text style={styles.itemRoom}>{line.room}</Text> : null}
          </View>
        );
      })}
      {notes.map((note) => (
        <Text key={note} style={styles.note}>
          {note}
        </Text>
      ))}
      {failure ? <Text style={styles.failure}>{failure}</Text> : null}
      {expiresIn ? <Text style={styles.expires}>{expiresIn}</Text> : null}
      {inlineError ? <Text style={styles.error}>{inlineError}</Text> : null}
      {state.canAct ? (
        <View style={styles.buttons}>
          <Pressable
            style={[styles.button, styles.cancelButton, isBusy && styles.buttonDisabled]}
            onPress={() => onCancel(action)}
            disabled={isBusy}
            accessibilityRole="button"
            // Named even while the spinner replaces its text, and announced as busy meanwhile.
            accessibilityLabel={cancelLabel}
            accessibilityState={{ disabled: isBusy, busy: busy === 'cancel' }}
          >
            {busy === 'cancel' ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.button, styles.confirmButton, isBusy && styles.buttonDisabled]}
            onPress={() => onConfirm(action)}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
            accessibilityState={{ disabled: isBusy, busy: busy === 'confirm' }}
          >
            {busy === 'confirm' ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  item: { paddingVertical: 2 },
  itemText: { fontSize: 14, color: colors.textPrimary },
  itemRoom: { fontSize: 13, color: colors.textSecondary, marginLeft: spacing.md },
  note: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs },
  failure: { fontSize: 13, color: colors.error, fontWeight: '600', marginTop: spacing.xs },
  expires: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  error: { fontSize: 13, color: colors.error, marginTop: spacing.xs },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  button: {
    minHeight: 40,
    minWidth: 96,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  cancelButton: { borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface },
  confirmButton: { backgroundColor: colors.primary },
  cancelText: { color: colors.primary, fontWeight: '700' },
  confirmText: { color: colors.white, fontWeight: '700' },
});
