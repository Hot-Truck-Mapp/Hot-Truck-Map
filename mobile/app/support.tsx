import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { API_BASE } from '@/lib/api';
import { SUPPORT_EMAIL } from '@/lib/faq';
import { Colors } from '@/constants/colors';
import { Card, T, s as ui } from '@/components/ui';

/** Mobile twin of /support. */
export default function SupportScreen() {
  const router = useRouter();
  return (
    <ScrollView style={ui.screen} contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 14 }}>
      <Text style={styles.title}>Support</Text>
      <Text style={styles.sub}>We&apos;re here to help. Reach out and we&apos;ll get back to you within 24 hours.</Text>

      <Card style={{ padding: 20 }}>
        <Text style={styles.cardTitle}>Email Support</Text>
        <Text style={styles.cardBody}>For account issues, bug reports, or general questions.</Text>
        <TouchableOpacity onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}><Text style={styles.link}>{SUPPORT_EMAIL}</Text></TouchableOpacity>
      </Card>

      <Card style={{ padding: 20 }}>
        <Text style={styles.cardTitle}>Food Truck Operators</Text>
        <Text style={styles.cardBody}>Questions about listing your truck, going live, or managing orders.</Text>
        <TouchableOpacity onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Operator Support')}`)}><Text style={styles.link}>{SUPPORT_EMAIL}</Text></TouchableOpacity>
      </Card>

      <Card style={{ padding: 20 }}>
        <Text style={styles.cardTitle}>FAQs</Text>
        {[
          'The app is currently free to use while we grow the community.',
          'Customers pay at the truck — no online payments.',
          'Trucks must sign up and tap "Go Live" to appear on the map.',
          'To delete your account, go to Account → Delete Account in the app.',
        ].map((line) => <Text key={line} style={styles.bullet}>•  {line}</Text>)}
      </Card>

      <TouchableOpacity onPress={() => router.push('/contact')} style={styles.contactBtn} accessibilityRole="button">
        <Text style={styles.contactText}>Send us a message →</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerLink} onPress={() => Linking.openURL(`${API_BASE}/privacy`)}>Privacy Policy</Text>
        <Text style={styles.footerDot}>·</Text>
        <Text style={styles.footerLink} onPress={() => Linking.openURL(`${API_BASE}/terms`)}>Terms of Service</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 30, fontWeight: '900', color: T.n900 },
  sub: { fontSize: 15, color: T.n500, lineHeight: 22, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: T.n800, marginBottom: 4 },
  cardBody: { fontSize: 14, color: T.n500, marginBottom: 10, lineHeight: 20 },
  link: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  bullet: { fontSize: 14, color: T.n600, lineHeight: 21, marginTop: 6 },
  contactBtn: { alignItems: 'center', paddingVertical: 12 },
  contactText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  footerLink: { fontSize: 12, color: T.n400 },
  footerDot: { fontSize: 12, color: T.n300 },
});
