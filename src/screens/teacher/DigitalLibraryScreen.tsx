import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SectionTitle } from '../../components/SectionTitle';
import { colors, radius, spacing } from '../../theme/colors';
import type { TeacherStackParamList } from '../../types/teacher';

type Props = NativeStackScreenProps<TeacherStackParamList, 'DigitalLibrary'>;

const books = [
  { id: '1', title: 'Mathematics Grade 10', author: 'NCERT', category: 'Textbook' },
  { id: '2', title: 'Modern Physics', author: 'H.C. Verma', category: 'Reference' },
  { id: '3', title: 'English Literature', author: 'Oxford', category: 'Textbook' },
  { id: '4', title: 'World History', author: 'Bipin Chandra', category: 'Reference' },
];

export function DigitalLibraryScreen({ navigation }: Props) {
  return (
    <View style={styles.root}>
      <ScreenHeader title="Digital Library" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <SectionTitle title="Available Books" />
        <ScrollView showsVerticalScrollIndicator={false}>
          {books.map((book) => (
            <TouchableOpacity key={book.id} style={styles.bookCard}>
              <View style={styles.bookIcon}>
                <FontAwesome5 name="book" size={24} color={colors.primary} />
              </View>
              <View style={styles.bookDetails}>
                <Text style={styles.bookTitle}>{book.title}</Text>
                <Text style={styles.bookAuthor}>{book.author} · {book.category}</Text>
              </View>
              <FontAwesome5 name="chevron-right" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.emptyPrompt}>
          <FontAwesome5 name="cloud-download-alt" size={40} color={colors.textMuted} />
          <Text style={styles.promptText}>Tap a book to download for offline reading</Text>
        </View>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  bookIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  bookDetails: {
    flex: 1,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  bookAuthor: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  emptyPrompt: {
    alignItems: 'center',
    marginTop: spacing.xl,
    padding: spacing.xl,
  },
  promptText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
