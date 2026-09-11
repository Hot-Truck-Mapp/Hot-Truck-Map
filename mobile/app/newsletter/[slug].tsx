import { useRef } from 'react';
import {
  KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { NewsletterSubscribe } from '@/components/NewsletterSubscribe';
import { useNewsletterIssues } from '@/hooks/useNewsletter';
import {
  NEWSLETTER_NAME, nextIssueLabel, readMinutes, type NewsletterItem,
} from '@shared/newsletter';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://hottruckmap.com';

const TAG_COLORS: Record<NewsletterItem['tag'], { bg: string; fg: string; border: string }> = {
  NEW: { bg: `${Colors.primary}1A`, fg: Colors.primary, border: Colors.primary },
  IMPROVED: { bg: '#F973161A', fg: '#C2410C', border: '#F97316' },
  FIX: { bg: Colors.border, fg: '#525252', border: '#D4D4D4' },
  TIP: { bg: '#FEF3C7', fg: '#92400E', border: '#FBBF24' },
};

function countyLabel(county: string): string {
  return /County$/i.test(county) ? county : `${county} County`;
}

/** Mobile twin of app/newsletter/[slug]/page.tsx. */
export default function NewsletterIssueScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const issues = useNewsletterIssues();
  const scrollRef = useRef<ScrollView>(null);
  const bodyY = useRef(0);
  const stateY = useRef<Record<string, number>>({});

  const idx = issues.findIndex((u) => u.slug === slug);
  const issue = idx >= 0 ? issues[idx] : undefined;

  if (!issue) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={{ title: 'Newsletter' }} />
        <Text style={styles.missingText}>Issue not found</Text>
        <TouchableOpacity onPress={() => router.replace('/newsletter')} accessibilityRole="button">
          <Text style={styles.link}>See all issues</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const older = issues[idx + 1];
  const newer = issues[idx - 1];

  // Issue links are written as website paths. Ones the app has its own screen
  // for stay in the app; anything else opens the website.
  function openHref(href: string) {
    if (href === '/events' || href.startsWith('/events/')) router.push(href as any);
    else Linking.openURL(`${API_BASE}${href}`);
  }

  function jumpToState(code: string) {
    const y = stateY.current[code];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: bodyY.current + y - 12, animated: true });
  }

  const guide = issue.eventGuide;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: `Issue #${issue.issue}` }} />
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Masthead */}
        <View style={styles.masthead}>
          <Text style={styles.eyebrow}>{NEWSLETTER_NAME.toUpperCase()} · A HOT TRUCK MAP PUBLICATION</Text>
          <Text style={styles.mastMeta}>
            Issue #{issue.issue} · {issue.dateLabel} · {readMinutes(issue)} min read
          </Text>
          <Text style={styles.mastTitle}>{issue.headline.emoji} {issue.title}</Text>
        </View>

        <View style={styles.body} onLayout={(e) => { bodyY.current = e.nativeEvent.layout.y; }}>
          {/* TL;DR */}
          <View style={styles.card}>
            <Text style={styles.label}>IN THIS ISSUE</Text>
            {issue.tldr.map((t) => (
              <View key={t} style={styles.tldrRow}>
                <Text style={styles.tldrDash}>—</Text>
                <Text style={styles.tldrText}>{t}</Text>
              </View>
            ))}
          </View>

          {/* Headline story */}
          <View style={styles.card}>
            <View style={styles.headlineTag}>
              <Text style={styles.headlineTagText}>{issue.headline.tag}</Text>
            </View>
            <Text style={styles.h2}>{issue.headline.title}</Text>
            {issue.headline.body.map((p, i) => (
              <Text key={i} style={styles.paragraph}>{p}</Text>
            ))}
            {issue.headline.cta && (
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={() => openHref(issue.headline.cta!.href)}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <Text style={styles.ctaText}>{issue.headline.cta.label}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Weekend event guide */}
          {guide && (
            <View style={styles.guideHeader}>
              <Text style={styles.guideDates}>{guide.dateRange.toUpperCase()}</Text>
              <Text style={styles.guideTitle}>{guide.heading}</Text>
              <View style={styles.guideChips}>
                {guide.states.map((st) => {
                  const total = st.groups.reduce((n, g) => n + g.events.length, 0);
                  return (
                    <TouchableOpacity
                      key={st.stateCode}
                      style={styles.guideChip}
                      onPress={() => jumpToState(st.stateCode)}
                      accessibilityRole="button"
                      accessibilityLabel={`Jump to ${st.stateName}, ${total} events`}
                    >
                      <Text style={styles.guideChipText}>{st.stateName} · {total} events</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {guide?.states.map((st) => (
            <View
              key={st.stateCode}
              style={styles.card}
              onLayout={(e) => { stateY.current[st.stateCode] = e.nativeEvent.layout.y; }}
            >
              <View style={styles.stateHead}>
                <Text style={styles.stateName}>{st.stateName}</Text>
                <TouchableOpacity
                  onPress={() => router.push(`/events/${st.stateCode.toLowerCase()}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`All ${st.stateName} events`}
                >
                  <Text style={styles.link}>All {st.stateCode} events →</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.paragraph, styles.stateIntro]}>{st.intro}</Text>

              {st.groups.map((group) => (
                <View key={group.label} style={styles.group}>
                  <Text style={styles.groupLabel}>{group.label.toUpperCase()}</Text>
                  {group.events.map((ev) => (
                    <TouchableOpacity
                      key={ev.festivalId}
                      style={ev.pick ? styles.pickEvent : styles.event}
                      activeOpacity={0.7}
                      onPress={() => router.push(`/event/${ev.festivalId}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`${ev.pick ? "Editor's pick: " : ''}${ev.name}, ${ev.when}, ${ev.city}`}
                    >
                      {ev.pick && (
                        <View style={styles.pickBadge}>
                          <Text style={styles.pickBadgeText}>★ EDITOR&rsquo;S PICK</Text>
                        </View>
                      )}
                      <Text style={styles.eventName}>{ev.name}</Text>
                      <Text style={styles.eventWhen}>{ev.when}</Text>
                      <Text style={styles.eventWhere}>
                        {ev.city} · {countyLabel(ev.county)}{ev.venue ? ` · ${ev.venue}` : ''}
                      </Text>
                      <Text style={styles.eventBlurb}>{ev.blurb}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          ))}

          {guide && <Text style={styles.guideNote}>{guide.note}</Text>}

          {/* Other items */}
          {issue.items.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.label}>{(issue.itemsHeading ?? 'Also in This Issue').toUpperCase()}</Text>
              {issue.items.map((item) => {
                const c = TAG_COLORS[item.tag] ?? TAG_COLORS.NEW;
                return (
                  <View key={item.title} style={[styles.item, { borderLeftColor: c.border }]}>
                    <View style={styles.itemHead}>
                      <Text style={styles.itemEmoji}>{item.emoji}</Text>
                      <View style={[styles.itemTag, { backgroundColor: c.bg }]}>
                        <Text style={[styles.itemTagText, { color: c.fg }]}>{item.tag}</Text>
                      </View>
                    </View>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemBody}>{item.body}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Sign-off */}
          <View style={styles.card}>
            <Text style={styles.paragraph}>
              That&rsquo;s it for this issue — thanks for reading.{' '}
              {issue.signOffPrompt ?? 'Spot a bug, or want to see something built?'}{' '}
              <Text style={styles.linkInline} onPress={() => openHref('/contact')} accessibilityRole="link">
                Tell us
              </Text>
              .
            </Text>
            <Text style={styles.signature}>— The Hot Truck Map Team</Text>
          </View>

          {/* Prev / next issue nav */}
          {(older || newer) && (
            <View style={styles.issueNav}>
              {older ? (
                <TouchableOpacity onPress={() => router.replace(`/newsletter/${older.slug}`)} accessibilityRole="button">
                  <Text style={styles.issueNavText}>← Issue #{older.issue}</Text>
                </TouchableOpacity>
              ) : <View />}
              {newer ? (
                <TouchableOpacity onPress={() => router.replace(`/newsletter/${newer.slug}`)} accessibilityRole="button">
                  <Text style={styles.issueNavText}>Issue #{newer.issue} →</Text>
                </TouchableOpacity>
              ) : <View />}
            </View>
          )}

          <View>
            <Text style={styles.nextIssue}>Next issue lands {nextIssueLabel(issues)}</Text>
            <NewsletterSubscribe />
          </View>

          <TouchableOpacity onPress={() => router.push('/newsletter')} accessibilityRole="button" style={styles.allIssues}>
            <Text style={styles.allIssuesText}>← All issues of {NEWSLETTER_NAME}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.card },
  scroll: { paddingBottom: 40 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  missingText: { fontSize: 16, color: Colors.textSecondary },
  masthead: {
    backgroundColor: Colors.dark,
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 28,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.6, color: Colors.primaryLight, marginBottom: 12, textAlign: 'center' },
  mastMeta: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 10 },
  mastTitle: { fontSize: 24, fontWeight: '900', color: Colors.textInverse, textAlign: 'center', lineHeight: 30 },
  body: { padding: 16, paddingTop: 24, gap: 16 },
  card: { backgroundColor: Colors.background, borderRadius: 16, padding: 20, ...shadow },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: Colors.textMuted, marginBottom: 12 },
  tldrRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tldrDash: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  tldrText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#262626', lineHeight: 20 },
  headlineTag: {
    alignSelf: 'flex-start',
    backgroundColor: `${Colors.primary}1A`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  headlineTagText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5, color: Colors.primary },
  h2: { fontSize: 20, fontWeight: '900', color: Colors.text, marginBottom: 12 },
  paragraph: { fontSize: 14, color: '#404040', lineHeight: 22, marginBottom: 10 },
  ctaButton: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 11,
    marginTop: 6,
  },
  ctaText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  guideHeader: { backgroundColor: Colors.dark, borderRadius: 16, padding: 20, alignItems: 'center' },
  guideDates: { fontSize: 10, fontWeight: '900', letterSpacing: 1.6, color: Colors.primaryLight, marginBottom: 6 },
  guideTitle: { fontSize: 20, fontWeight: '900', color: Colors.textInverse },
  guideChips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14 },
  guideChip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  guideChipText: { color: Colors.textInverse, fontSize: 12, fontWeight: '700' },
  stateHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingBottom: 10,
    marginBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: `${Colors.primary}33`,
  },
  stateName: { fontSize: 20, fontWeight: '900', color: Colors.text },
  stateIntro: { marginBottom: 6 },
  group: { marginTop: 18 },
  groupLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: Colors.textMuted, marginBottom: 10 },
  event: { borderLeftWidth: 2, borderLeftColor: Colors.border, paddingLeft: 14, paddingVertical: 4, marginBottom: 14 },
  pickEvent: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    backgroundColor: `${Colors.primary}0D`,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  pickBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  pickBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  eventName: { fontSize: 14, fontWeight: '700', color: Colors.text, lineHeight: 19 },
  eventWhen: { fontSize: 12, fontWeight: '700', color: Colors.primary, marginTop: 2 },
  eventWhere: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, lineHeight: 17 },
  eventBlurb: { fontSize: 14, color: '#525252', lineHeight: 20, marginTop: 6 },
  guideNote: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18, paddingHorizontal: 4 },
  item: { borderLeftWidth: 2, paddingLeft: 14, marginBottom: 16 },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  itemEmoji: { fontSize: 16 },
  itemTag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  itemTagText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  itemTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  itemBody: { fontSize: 14, color: '#525252', lineHeight: 20 },
  signature: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginTop: 2 },
  link: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  linkInline: { color: Colors.primary, fontWeight: '700' },
  issueNav: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  issueNavText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  nextIssue: { textAlign: 'center', fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginBottom: 10 },
  allIssues: { alignItems: 'center', paddingVertical: 12 },
  allIssuesText: { fontSize: 12, color: Colors.textMuted },
});
