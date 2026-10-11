import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../../api/errorMessage';
import {
  cancelPayrollRun,
  createPayrollRun,
  getPayrollRun,
  payPayrollRun,
  processPayrollRun,
  reprocessPayrollRun,
  setPayrollLineHold,
} from '../../api/payrollRuns';
import { listSalaryStructures } from '../../api/salaryStructures';
import type { PayrollLine, PayrollPaymentMethod, PayrollRunDetail, PayrollSkippedEmployee } from '../../api/types';
import { DatePickerField, parseIsoDate } from '../../components/DatePickerField';
import Dropdown from '../../components/Dropdown';
import { ErrorNotice } from '../../components/ErrorNotice';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { localToday } from '../../utils/assessmentStatus';
import {
  conflictData,
  formatInr,
  formatPayrollDate,
  lineStatusLabel,
  lineStatusVariant,
  lineWarningText,
  monthName,
  payConfirmation,
  paymentDateBounds,
  paymentMethodOptions,
  payRequest,
  runActions,
  runMonthLabel,
  runMonthOptions,
  runStatusLabel,
  runStatusVariant,
  skippedAction,
  skipReasonText,
  structureToEdit,
} from '../../utils/payroll';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PayrollRun'>;

/** The server's limit on a payment reference. */
const MAX_REFERENCE_LENGTH = 100;

/**
 * One month's payroll run (specs/payroll-runs). Without a runId it picks a month and creates the
 * run; with one it shows the run as the server has it and offers only what the server allows next:
 * process, recalculate, cancel, hold lines, and pay. Every action returns the whole run, and after a
 * failed one (a timeout included) the run is loaded again, so the screen never shows a stale state.
 */
export function PayrollRunScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const runId = route.params?.runId;

  const today = localToday();
  const monthOptions = useMemo(() => runMonthOptions(today), [today]);
  const [year, setYear] = useState(String(monthOptions[0].year));
  const [month, setMonth] = useState('');

  const [detail, setDetail] = useState<PayrollRunDetail | null>(null);
  const [loading, setLoading] = useState(!!runId);
  const [loadError, setLoadError] = useState<string | null>(null);
  // What's in flight: 'create', 'process', 'recalculate', 'cancel', 'pay', or a line or employee id.
  const [busy, setBusy] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PayrollPaymentMethod | ''>('');
  const [paymentReference, setPaymentReference] = useState('');
  const [pickedDate, setPickedDate] = useState('');

  const fetchRun = useCallback(
    async (id: string) => {
      setLoadError(null);
      try {
        setDetail(await getPayrollRun(schoolId, id));
      } catch (e) {
        setLoadError(getErrorMessage(e));
      }
    },
    [schoolId]
  );

  // Reloads on focus too, so a salary structure fixed from "Left out" shows up on the way back.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (!runId) return;
      setLoading(true);
      fetchRun(runId).finally(() => setLoading(false));
    });
    return unsubscribe;
  }, [navigation, runId, fetchRun]);

  const openRun = (id: string) => {
    navigation.setParams({ runId: id });
    setLoading(true);
    fetchRun(id).finally(() => setLoading(false));
  };

  const yearMonths = monthOptions.find((o) => String(o.year) === year)?.months ?? [];
  const YEAR_OPTIONS = monthOptions.map((o) => ({ label: String(o.year), value: String(o.year) }));
  const MONTH_OPTIONS = yearMonths.map((m) => ({ label: monthName(m, t), value: String(m) }));

  const selectYear = (value: string) => {
    setYear(value);
    const months = monthOptions.find((o) => String(o.year) === value)?.months ?? [];
    if (month && !months.includes(Number(month))) setMonth('');
  };

  const createRun = async (req: { month: number; year: number }) => {
    setBusy('create');
    try {
      const created = await createPayrollRun(schoolId, req);
      setDetail(created);
      navigation.setParams({ runId: created.id });
    } catch (e) {
      const existing = conflictData(e, 'PAYROLL_RUN_EXISTS');
      const existingId = typeof existing?.runId === 'string' ? existing.runId : null;
      if (existingId) {
        Alert.alert(t('payroll.run.existsTitle'), t('payroll.run.existsBody', { month: runMonthLabel(req.month, req.year, t) }), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('payroll.run.openExisting'), onPress: () => openRun(existingId) },
        ]);
      } else {
        showToast(getErrorMessage(e), 'error');
      }
    } finally {
      setBusy(null);
    }
  };

  /** Runs an action that returns the whole run. On any failure, says why and loads the run as it is now. */
  const act = async (kind: string, call: () => Promise<PayrollRunDetail>, onDone?: () => void) => {
    if (!detail) return;
    const id = detail.id;
    setBusy(kind);
    try {
      setDetail(await call());
      onDone?.();
    } catch (e) {
      if (conflictData(e, 'PAYROLL_RUN_CHANGED')) {
        showToast(t('payroll.run.runChanged'), 'info');
      } else {
        showToast(getErrorMessage(e), 'error');
      }
      await fetchRun(id);
    } finally {
      setBusy(null);
    }
  };

  const handleProcess = () => {
    if (detail) act('process', () => processPayrollRun(schoolId, detail.id));
  };

  const handleRecalculate = () => {
    if (!detail) return;
    Alert.alert(t('payroll.run.recalculateConfirmTitle'), t('payroll.run.recalculateConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('payroll.run.recalculateButton'),
        onPress: () => act('recalculate', () => reprocessPayrollRun(schoolId, detail.id)),
      },
    ]);
  };

  const handleCancel = () => {
    if (!detail) return;
    Alert.alert(
      t('payroll.run.cancelConfirmTitle'),
      t('payroll.run.cancelConfirmBody', { month: runMonthLabel(detail.month, detail.year, t) }),
      [
        { text: t('payroll.run.keepRun'), style: 'cancel' },
        {
          text: t('payroll.run.cancelConfirm'),
          style: 'destructive',
          onPress: () => act('cancel', () => cancelPayrollRun(schoolId, detail.id)),
        },
      ]
    );
  };

  const handleHold = (line: PayrollLine) => {
    act(line.id, () => setPayrollLineHold(schoolId, line.id, !line.held));
  };

  const bounds = detail ? paymentDateBounds(detail, today) : null;
  // The admin's pick while it's allowed, else today kept within the run's dates.
  const payDate =
    bounds && pickedDate && pickedDate >= bounds.min && pickedDate <= bounds.max ? pickedDate : (bounds?.defaultDate ?? '');

  const handlePay = () => {
    if (!detail || !paymentMethod || !payDate) return;
    // What the admin confirms is what's sent: the server refuses if the run changed since (409).
    const shown = detail;
    const method = paymentMethod;
    const confirm = payConfirmation(shown, method, payDate, t);
    Alert.alert(confirm.title, confirm.body, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('payroll.run.payConfirm'),
        onPress: () =>
          act(
            'pay',
            () => payPayrollRun(schoolId, shown.id, payRequest(shown, method, paymentReference, payDate)),
            () => {
              setPaymentReference('');
              showToast(t('payroll.run.paidToast', { count: shown.payableLineCount }), 'success');
            }
          ),
      },
    ]);
  };

  const handleFixStructure = async (skipped: PayrollSkippedEmployee) => {
    setBusy(skipped.employeeId);
    try {
      const structures = await listSalaryStructures(schoolId, { employeeId: skipped.employeeId });
      const structure = structureToEdit(structures, skipped.structureId);
      navigation.navigate(
        'SalaryStructureForm',
        structure ? { structure } : { employee: { id: skipped.employeeId, name: skipped.employeeName } }
      );
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const title = detail ? runMonthLabel(detail.month, detail.year, t) : t('payroll.run.title');

  if (!runId && !detail) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={title} onBack={() => navigation.goBack()} />
        <ScreenContainer>
          <Dropdown label={t('payroll.run.year')} required value={year} options={YEAR_OPTIONS} onSelect={selectYear} />
          <Dropdown label={t('payroll.run.month')} required value={month} options={MONTH_OPTIONS} onSelect={setMonth} />
          <Pressable
            style={[styles.button, (!month || !year || !!busy) && styles.buttonDisabled]}
            onPress={() => createRun({ month: Number(month), year: Number(year) })}
            disabled={!month || !year || !!busy}
          >
            <Text style={styles.buttonText}>{busy ? t('payroll.run.creating') : t('payroll.run.createButton')}</Text>
          </Pressable>
        </ScreenContainer>
      </View>
    );
  }

  const actions = detail ? runActions(detail) : null;

  return (
    <View style={styles.root}>
      <ScreenHeader title={title} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {loading && !detail && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {loadError && (
          <>
            <ErrorNotice message={loadError} />
            {runId && (
              <Pressable style={styles.secondaryButton} onPress={() => openRun(runId)} disabled={loading}>
                <Text style={styles.secondaryButtonText}>{t('common.retry')}</Text>
              </Pressable>
            )}
          </>
        )}

        {detail && actions && (
          <View>
            <View style={styles.runHeader}>
              <Text style={styles.runTitle}>{runMonthLabel(detail.month, detail.year, t)}</Text>
              <StatusChip label={runStatusLabel(detail.status, t)} variant={runStatusVariant(detail.status)} />
            </View>

            {actions.futureMonth && <Text style={styles.note}>{t('payroll.run.futureMonth')}</Text>}

            {detail.status === 'CANCELLED' ? (
              <View>
                <Text style={styles.note}>{t('payroll.run.cancelledNote')}</Text>
                {actions.runAgain && (
                  <Pressable
                    style={[styles.button, !!busy && styles.buttonDisabled]}
                    onPress={() => createRun({ month: detail.month, year: detail.year })}
                    disabled={!!busy}
                  >
                    <Text style={styles.buttonText}>{busy ? t('payroll.run.creating') : t('payroll.run.runAgain')}</Text>
                  </Pressable>
                )}
              </View>
            ) : detail.status === 'DRAFT' ? null : (
              <View style={styles.card}>
                <SummaryRow label={t('payroll.run.staffCount')} value={String(detail.lineCount)} />
                <SummaryRow label={t('payroll.run.totalNet')} value={formatInr(detail.totalNet)} />
                <SummaryRow
                  label={t('payroll.run.paid')}
                  value={t('payroll.run.summaryValue', { count: detail.paidLineCount, amount: formatInr(detail.paidNet) })}
                />
                <SummaryRow
                  label={t('payroll.run.onHold')}
                  value={t('payroll.run.summaryValue', { count: detail.heldLineCount, amount: formatInr(detail.heldNet) })}
                />
                <SummaryRow
                  label={t('payroll.run.toPayNow')}
                  value={t('payroll.run.summaryValue', { count: detail.payableLineCount, amount: formatInr(detail.payableNet) })}
                  strong
                />
              </View>
            )}

            {actions.process && (
              <Pressable style={[styles.button, !!busy && styles.buttonDisabled]} onPress={handleProcess} disabled={!!busy}>
                <Text style={styles.buttonText}>{busy === 'process' ? t('payroll.run.processing') : t('payroll.run.processButton')}</Text>
              </Pressable>
            )}
            {actions.recalculate && (
              <Pressable style={[styles.secondaryButton, !!busy && styles.buttonDisabled]} onPress={handleRecalculate} disabled={!!busy}>
                <Text style={styles.secondaryButtonText}>
                  {busy === 'recalculate' ? t('payroll.run.recalculating') : t('payroll.run.recalculateButton')}
                </Text>
              </Pressable>
            )}

            {detail.status !== 'CANCELLED' && detail.status !== 'DRAFT' && (
              <View style={styles.section}>
                <Text style={styles.label}>{t('payroll.run.payrollLines', { count: detail.lines.length })}</Text>
                {detail.lines.length === 0 && <Text style={styles.empty}>{t('payroll.run.noLines')}</Text>}
                {detail.lines.map((line) => (
                  <Pressable
                    key={line.id}
                    style={styles.lineRow}
                    onPress={() => navigation.navigate('PayslipDetail', { payrollLineId: line.id, employeeName: line.employeeName })}
                  >
                    <View style={styles.lineTop}>
                      <View style={styles.lineMain}>
                        <Text style={styles.lineName}>{line.employeeName}</Text>
                        {line.designation ? <Text style={styles.lineMeta}>{line.designation}</Text> : null}
                      </View>
                      <StatusChip label={lineStatusLabel(line.status, t)} variant={lineStatusVariant(line.status)} />
                    </View>
                    <Text style={styles.lineMeta}>
                      {t('payroll.run.lineAmounts', {
                        gross: formatInr(line.gross),
                        deductions: formatInr(line.deductions),
                        net: formatInr(line.net),
                      })}
                    </Text>
                    {line.warnings.map((w) => (
                      <Text key={`${w.code}-${w.date ?? ''}`} style={styles.warning}>
                        {lineWarningText(w, t)}
                      </Text>
                    ))}
                    {actions.hold && line.status !== 'PAID' && (
                      <Pressable
                        style={[styles.smallButton, !!busy && styles.buttonDisabled]}
                        onPress={() => handleHold(line)}
                        disabled={!!busy}
                      >
                        <Text style={styles.smallButtonText}>{line.held ? t('payroll.run.release') : t('payroll.run.hold')}</Text>
                      </Pressable>
                    )}
                  </Pressable>
                ))}
              </View>
            )}

            {detail.skipped.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.label}>{t('payroll.run.skippedTitle', { count: detail.skipped.length })}</Text>
                {detail.skipped.map((s) => {
                  const next = skippedAction(s, actions);
                  return (
                    <View key={s.employeeId} style={styles.lineRow}>
                      <Text style={styles.lineName}>{s.employeeName}</Text>
                      {s.designation ? <Text style={styles.lineMeta}>{s.designation}</Text> : null}
                      <Text style={styles.warning}>{skipReasonText(s, t)}</Text>
                      {next === 'ADD_STRUCTURE' && (
                        <Pressable
                          style={[styles.smallButton, !!busy && styles.buttonDisabled]}
                          disabled={!!busy}
                          onPress={() =>
                            navigation.navigate('SalaryStructureForm', { employee: { id: s.employeeId, name: s.employeeName } })
                          }
                        >
                          <Text style={styles.smallButtonText}>{t('payroll.run.addStructure')}</Text>
                        </Pressable>
                      )}
                      {next === 'FIX_STRUCTURE' && (
                        <Pressable
                          style={[styles.smallButton, !!busy && styles.buttonDisabled]}
                          disabled={!!busy}
                          onPress={() => handleFixStructure(s)}
                        >
                          <Text style={styles.smallButtonText}>{t('payroll.run.fixStructure')}</Text>
                        </Pressable>
                      )}
                      {next === 'RECALCULATE' && <Text style={styles.lineMeta}>{t('payroll.run.recalculateToAdd')}</Text>}
                    </View>
                  );
                })}
              </View>
            )}

            {actions.hold && detail.lineCount > 0 && detail.payableLineCount === 0 && (
              <Text style={styles.note}>{t('payroll.run.nothingToPay')}</Text>
            )}

            {actions.pay && bounds && (
              <View style={styles.paySection}>
                <Text style={styles.label}>{t('payroll.run.payThisRun')}</Text>
                <Dropdown
                  label={t('payroll.run.paymentMethod')}
                  required
                  value={paymentMethod}
                  options={paymentMethodOptions(t)}
                  onSelect={(value) => setPaymentMethod(value as PayrollPaymentMethod)}
                />
                <LabeledInput
                  label={t('payroll.run.paymentReference')}
                  value={paymentReference}
                  onChangeText={setPaymentReference}
                  maxLength={MAX_REFERENCE_LENGTH}
                />
                <DatePickerField
                  label={t('payroll.run.transactionDate')}
                  value={payDate}
                  onChange={setPickedDate}
                  minimumDate={parseIsoDate(bounds.min)}
                  maximumDate={parseIsoDate(bounds.max)}
                />
                <Text style={styles.hint}>
                  {t('payroll.run.paymentDateHint', {
                    min: formatPayrollDate(bounds.min, t),
                    max: formatPayrollDate(bounds.max, t),
                  })}
                </Text>
                <Pressable
                  style={[styles.button, (!paymentMethod || !!busy) && styles.buttonDisabled]}
                  onPress={handlePay}
                  disabled={!paymentMethod || !!busy}
                >
                  <Text style={styles.buttonText}>{busy === 'pay' ? t('payroll.run.paying') : t('payroll.run.payButton')}</Text>
                </Pressable>
              </View>
            )}

            {actions.cancel && (
              <Pressable style={styles.cancelLink} onPress={handleCancel} disabled={!!busy}>
                <Text style={styles.cancelText}>{t('payroll.run.cancelButton')}</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, strong && styles.summaryValueStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: 40 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  note: { color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 20 },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: -spacing.sm, marginBottom: spacing.sm },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...softShadow,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontWeight: '700' },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  secondaryButtonText: { color: colors.primary, fontWeight: '700' },
  runHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  runTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  summaryLabel: { fontSize: 13, color: colors.textMuted },
  summaryValue: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  summaryValueStrong: { fontWeight: '800', color: accents.payroll.base },
  section: { marginTop: spacing.xl },
  empty: { color: colors.textMuted },
  lineRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  lineTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs },
  lineMain: { flex: 1, marginRight: spacing.sm },
  lineName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  lineMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  warning: { fontSize: 12, color: colors.warning, marginTop: spacing.xs },
  smallButton: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  smallButtonText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  paySection: { marginTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg },
  cancelLink: { marginTop: spacing.xl, alignItems: 'center' },
  cancelText: { color: colors.error, fontWeight: '600' },
});
