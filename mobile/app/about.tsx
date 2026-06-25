import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';

const VALUES: { title: string; body: string }[] = [
  {
    title: 'Community First',
    body: 'Food trucks are small businesses run by real people. We exist to lift them up — never to take a cut of their hard-earned sales.',
  },
  {
    title: 'Real-Time, Always',
    body: 'Trucks move. Schedules change. Our live GPS map means you find the food truck — not yesterday’s parking spot.',
  },
  {
    title: 'Free For Everyone',
    body: 'No subscription fees. No commissions on orders. No paywalls hiding the trucks customers want to find.',
  },
  {
    title: 'Built For The Road',
    body: 'Every feature — from Go Live to catering bookings — solves a real problem operators face every day.',
  },
];

const STATS: { label: string; value: string; sub: string }[] = [
  { label: 'States', value: '50', sub: 'Coast to coast goal' },
  { label: 'Cost', value: '$0', sub: 'Free for everyone' },
  { label: 'Updates', value: 'Live', sub: 'Real-time GPS' },
  { label: 'Commission', value: 'None', sub: 'Operators keep 100%' },
];

export default function AboutScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>OUR MISSION</Text>
          <Text style={styles.heroTitle}>
            Connecting the world{'\n'}
            <Text style={styles.heroAccent}>one food truck</Text> at a time.
          </Text>
          <Text style={styles.heroBody}>
            Hot Truck Map is building the largest real-time food truck community in America — one
            block, one city, one state at a time, until every operator and every hungry customer
            can find each other across all 50 states.
          </Text>
        </View>

        {/* Story */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>OUR STORY</Text>
          <Text style={styles.sectionTitle}>
            Built because finding a food truck shouldn&rsquo;t feel like a scavenger hunt.
          </Text>
          <Text style={styles.paragraph}>
            Anyone who&rsquo;s ever chased a food truck knows the feeling — you saw a post on
            Instagram last Tuesday, drove twenty minutes to the spot, and the truck is nowhere to
            be found. Meanwhile, three blocks away, an incredible operator is parked with no line
            because their regulars don&rsquo;t know they&rsquo;re there.
          </Text>
          <Text style={styles.paragraph}>
            That gap — between brilliant food and the people who want to eat it — is what we set
            out to close. Hot Truck Map gives operators a free, professional home and a one-tap
            way to broadcast their live location. It gives customers a real map of what&rsquo;s
            open right now, not what was open last week.
          </Text>
          <Text style={styles.paragraph}>
            We&rsquo;re not a delivery app. We&rsquo;re not a marketplace skimming commissions.
            We&rsquo;re a community — built for the operators, the regulars, and everyone who
            believes the best food in America is being served out of a window on wheels.
          </Text>
        </View>

        {/* Vision (dark card) */}
        <View style={styles.darkCard}>
          <Text style={styles.darkEyebrow}>THE VISION</Text>
          <Text style={styles.darkTitle}>
            One nation. <Text style={styles.darkAccent}>Fifty states.</Text> Every food truck on the map.
          </Text>
          <Text style={styles.darkBody}>
            From the taco trucks of East LA to the lobster rolls of coastal Maine — America&rsquo;s
            food truck scene is one of the most creative culinary movements on earth. Our goal is
            simple: a single, real-time map where every truck has a home.
          </Text>
          <View style={styles.statsGrid}>
            {STATS.map((s) => (
              <View key={s.label} style={styles.statCard}>
                <Text style={styles.statLabel}>{s.label}</Text>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statSub}>{s.sub}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Values */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>WHAT WE BELIEVE</Text>
          <Text style={styles.sectionTitle}>The principles behind every line of code.</Text>
          <View style={styles.valuesGrid}>
            {VALUES.map((v) => (
              <View key={v.title} style={styles.valueCard}>
                <Text style={styles.valueTitle}>{v.title}</Text>
                <Text style={styles.valueBody}>{v.body}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.footer}>© {new Date().getFullYear()} Hot Truck Map</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },

  // Hero
  hero: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 28 },
  eyebrow: {
    fontSize: 11, fontWeight: '800', color: Colors.primary,
    letterSpacing: 2, marginBottom: 10,
  },
  heroTitle: {
    fontSize: 30, fontWeight: '800', color: Colors.text,
    lineHeight: 36, letterSpacing: -0.5, marginBottom: 14,
  },
  heroAccent: { color: Colors.primary },
  heroBody: {
    fontSize: 15, lineHeight: 23, color: Colors.textSecondary,
  },

  // Section
  section: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 },
  sectionEyebrow: {
    fontSize: 11, fontWeight: '800', color: Colors.primary,
    letterSpacing: 2, marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 22, fontWeight: '800', color: Colors.text,
    lineHeight: 28, letterSpacing: -0.3, marginBottom: 14,
  },
  paragraph: {
    fontSize: 15, lineHeight: 23, color: Colors.textSecondary, marginBottom: 14,
  },

  // Dark card (vision)
  darkCard: {
    backgroundColor: Colors.dark,
    marginHorizontal: 16, marginTop: 24,
    borderRadius: 20, padding: 24,
  },
  darkEyebrow: {
    fontSize: 11, fontWeight: '800', color: '#F5A623',
    letterSpacing: 2, marginBottom: 10,
  },
  darkTitle: {
    fontSize: 22, fontWeight: '800', color: '#fff',
    lineHeight: 28, letterSpacing: -0.3, marginBottom: 12,
  },
  darkAccent: { color: '#F5A623' },
  darkBody: {
    fontSize: 14, lineHeight: 21, color: '#D4D4D4', marginBottom: 18,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    flexBasis: '48%', flexGrow: 1,
    backgroundColor: Colors.darkCard,
    borderWidth: 1, borderColor: Colors.borderDark,
    borderRadius: 14, padding: 14,
  },
  statLabel: {
    fontSize: 10, fontWeight: '800', color: Colors.textMuted,
    letterSpacing: 1.5, marginBottom: 4,
  },
  statValue: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 4 },
  statSub: { fontSize: 11, color: Colors.textMuted, lineHeight: 14 },

  // Values
  valuesGrid: { gap: 10, marginTop: 4 },
  valueCard: {
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 16,
  },
  valueTitle: {
    fontSize: 15, fontWeight: '800', color: Colors.text, marginBottom: 4,
  },
  valueBody: {
    fontSize: 14, lineHeight: 20, color: Colors.textSecondary,
  },

  footer: {
    textAlign: 'center', fontSize: 12, color: Colors.textMuted,
    marginTop: 24, paddingHorizontal: 24,
  },
});
