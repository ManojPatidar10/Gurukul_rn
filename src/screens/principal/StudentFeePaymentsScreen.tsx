import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FeePaymentHistory } from '../../components/FeePaymentHistory';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'StudentFeePayments'>;

/**
 * Every payment on every fee bill of one student, newest first, each showing its bill's academic
 * year. Reached from My Fees (the student), Child Fees (a parent) and a bill's detail (admin and
 * family); the server refuses anyone else.
 */
export function StudentFeePaymentsScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { student } = route.params;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={student.name ? t('fees.paymentHistory.childTitle', { name: student.name }) : t('fees.paymentHistory.title')}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <FeePaymentHistory
          studentId={student.id}
          showAcademicYear
          onOpen={(payment) => navigation.navigate('PaymentReceipt', { payment })}
        />
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
