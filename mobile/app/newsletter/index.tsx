import { ScrollView, StyleSheet, Text, TouchableOpacity, View, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { NewsletterSubscribe } from '@/components/NewsletterSubscribe';
import { useNewsletterIssues } from '@/hooks/useNewsletter';
import { NEWSLETTER_NAME, NEWSLETTER_TAGLINE, nextIssueLabel, readMinutes } from '@shared/newsletter';

/** Mobile twin of app/newsletter/page.tsx. */
export default function NewsletterIndexScreen() {
  const router = useRouter();
  const issues = useNewsletterIssues();
  const [latest, ...older] = issues;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Masthead */}
        <View style={styles.masthead}>
          <View style={styles.eyebrowPill}>
            <Text style={styles.eyebrowText}>A HOT TRUCK MAP PUBLICATION · EVERY TWO WEEKS</Text>
          </View>
          <Text style={styles.mastTitle}>{NEWSLETTER_NAME}</Text>
          <Text style={styles.mastTagline}>{NEWSLETTER_TAGLINE}</Text>
        </View>

        <View style={styles.body}>
          {latest && (
            <View>
              <Text style={styles.sectionLabel}>LATEST ISSUE</Text>
              <TouchableOpacity
                style={styles.latestCard}
                activeOpacity={0.85}
                onPress={() => router.push(`/newsletter/${latest.slug}`)}
                accessibilityRole="button"
                accessibilityLabel={`Read issue ${latest.issue}: ${latest.title}`}
              >
                <Text style={styles.meta}>
                  Issue #{latest.issue} · {latest.dateLabel} · {readMinutes(latest)} min read
                </Text>
                <Text style={styles.latestTitle}>
                  {latest.headline.emoji} {latest.title}
                </Text>
                <Text style={styles.latestSummary}>{latest.summary}</Text>
                <View style={styles.chips}>
                  {latest.tldr.map((t) => (
                    <View key={t} style={styles.chip}>
                      <Text style={styles.chipText}>{t}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.readMore}>Read the full issue →</Text>
              </TouchableOpacity>
            </View>
          )}

          {older.length > 0 && (
            <View>
              <Text style={styles.sectionLabel}>PAST ISSUES</Text>
              {older.map((u) => (
                <TouchableOpacity
                  key={u.slug}
                  style={styles.pastRow}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/newsletter/${u.slug}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Read issue ${u.issue}: ${u.title}`}
                >
                  <View style={styles.flex}>
                    <Text style={styles.pastMeta}>Issue #{u.issue} · {u.dateLabel}</Text>
                    <Text style={styles.pastTitle}>{u.headline.emoji} {u.title}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View>
            <Text style={styles.nextIssue}>Next issue lands {nextIssueLabel(issues)}</Text>
            <NewsletterSubscribe />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.card },
  scroll: { paddingBottom: 48 },
  masthead: {
    backgroundColor: Colors.dark,
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 30,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  eyebrowPill: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 14,
  },
  eyebrowText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.6, color: Colors.primaryLight },
  mastTitle: { fontSize: 36, fontWeight: '900', color: Colors.textInverse, letterSpacing: -0.5 },
  mastTagline: { fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center', maxWidth: 320, lineHeight: 18 },
  body: { padding: 16, paddingTop: 28, gap: 28 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: Colors.textMuted, marginBottom: 10 },
  latestCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  meta: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 10 },
  latestTitle: { fontSize: 22, fontWeight: '900', color: Colors.text, lineHeight: 28, marginBottom: 10 },
  latestSummary: { fontSize: 14, color: '#525252', lineHeight: 21, marginBottom: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { backgroundColor: Colors.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: '600', color: '#525252' },
  readMore: { fontSize: 14, fontWeight: '900', color: Colors.primary },
  pastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 10,
  },
  pastMeta: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, marginBottom: 2 },
  pastTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  chevron: { fontSize: 22, color: '#D4D4D4' },
  nextIssue: { textAlign: 'center', fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginBottom: 10 },
});
