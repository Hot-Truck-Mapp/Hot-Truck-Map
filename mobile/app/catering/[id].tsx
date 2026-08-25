import { useEffect, useState, useRef } from 'react';
import {
  StyleSheet, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://hottruckmap.com';

export default function CateringRequestScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  // useLocalSearchParams can return a string[] if the param appears multiple times;
  // always take the scalar value to avoid passing an array to Supabase or the API.
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const navigation = useNavigation();
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  const [truckName, setTruckName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Load truck name for the header
  useEffect(() => {
    if (!id) return;
    void supabase
      .from('trucks')
      .select('name')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data && mountedRef.current) {
          setTruckName(data.name);
          navigation.setOptions({ title: `Catering — ${data.name}` });
        }
      });
  }, [id]);

  async function submit() {
    if (inFlightRef.current) return;

    // Validate required fields
    if (!customerName.trim()) { Alert.alert('Required', 'Please enter your name.'); return; }
    if (!customerEmail.trim()) { Alert.alert('Required', 'Please enter your email.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    if (!eventLocation.trim()) { Alert.alert('Required', 'Please enter the event location.'); return; }
    // Event date is required and must be ISO YYYY-MM-DD (matching API validation)
    const trimmedDate = eventDate.trim();
    if (!trimmedDate) {
      Alert.alert('Required', 'Please enter the event date (YYYY-MM-DD).');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate) || isNaN(new Date(trimmedDate).getTime())) {
      Alert.alert('Invalid date', 'Please enter a date in YYYY-MM-DD format (e.g. 2026-07-04).');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (trimmedDate < today) {
      Alert.alert('Invalid date', 'Event date must be today or in the future.');
      return;
    }

    const guestNum = parseInt(guestCount, 10);
    if (!guestCount || isNaN(guestNum) || guestNum < 1) {
      Alert.alert('Required', 'Please enter a valid guest count.');
      return;
    }

    const budgetNum = budget ? parseFloat(budget) : null;
    if (budget && (isNaN(budgetNum as number) || (budgetNum as number) < 0)) {
      Alert.alert('Invalid', 'Please enter a valid budget amount.');
      return;
    }

    inFlightRef.current = true;
    setSubmitting(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
      let res: Response;
      try {
        res = await fetch(`${API_BASE}/api/catering-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
          truck_id: id,
          customer_name: customerName.trim(),
          customer_email: customerEmail.trim().toLowerCase(),
          customer_phone: customerPhone.trim() || null,
          event_date: trimmedDate,
          event_time: eventTime.trim() || null,
          event_location: eventLocation.trim(),
          guest_count: guestNum,
          budget: budgetNum,
          notes: notes.trim() || null,
        }),
      });
      } finally {
        clearTimeout(timeout);
      }

      if (res.status === 429) {
        inFlightRef.current = false;
        if (mountedRef.current) setSubmitting(false);
        Alert.alert('Too many requests', 'Please wait a few minutes before submitting another request.');
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string })?.error ?? 'Could not submit request. Please try again.');
      }
      if (mountedRef.current) setSubmitted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not submit request. Please try again.';
      if (mountedRef.current) Alert.alert('Error', message);
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.successContainer}>
        <Text style={styles.successIcon}>🎉</Text>
        <Text style={styles.successTitle}>Request Sent!</Text>
        <Text style={styles.successBody}>
          The operator will contact you within 24 hours.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flex}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {truckName ? (
          <Text style={styles.heading}>Catering Request for {truckName}</Text>
        ) : (
          <Text style={styles.heading}>Catering Request</Text>
        )}
        <Text style={styles.subheading}>Fill out the form below and we&apos;ll get back to you within 24 hours.</Text>

        <Text style={styles.label}>Your Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Jane Smith"
          placeholderTextColor={Colors.textMuted}
          value={customerName}
          onChangeText={t => setCustomerName(t.slice(0, 100))}
          maxLength={100}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input}
          placeholder="jane@example.com"
          placeholderTextColor={Colors.textMuted}
          value={customerEmail}
          onChangeText={t => setCustomerEmail(t.slice(0, 200))}
          maxLength={200}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Phone (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="(555) 123-4567"
          placeholderTextColor={Colors.textMuted}
          value={customerPhone}
          onChangeText={t => setCustomerPhone(t.slice(0, 30))}
          maxLength={30}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Event Date * (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 2026-07-04"
          placeholderTextColor={Colors.textMuted}
          value={eventDate}
          onChangeText={t => setEventDate(t.slice(0, 50))}
          maxLength={50}
        />

        <Text style={styles.label}>Event Time (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 6:00 PM"
          placeholderTextColor={Colors.textMuted}
          value={eventTime}
          onChangeText={t => setEventTime(t.slice(0, 30))}
          maxLength={30}
        />

        <Text style={styles.label}>Event Location *</Text>
        <TextInput
          style={styles.input}
          placeholder="123 Main St, Springfield"
          placeholderTextColor={Colors.textMuted}
          value={eventLocation}
          onChangeText={t => setEventLocation(t.slice(0, 200))}
          maxLength={200}
        />

        <Text style={styles.label}>Guest Count *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 50"
          placeholderTextColor={Colors.textMuted}
          value={guestCount}
          onChangeText={t => setGuestCount(t.replace(/[^0-9]/g, '').slice(0, 6))}
          maxLength={6}
          keyboardType="number-pad"
        />

        <Text style={styles.label}>Budget (optional, $)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 2000"
          placeholderTextColor={Colors.textMuted}
          value={budget}
          onChangeText={t => setBudget(t.replace(/[^0-9.]/g, '').slice(0, 10))}
          maxLength={10}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          placeholder="Dietary restrictions, setup needs, special requests…"
          placeholderTextColor={Colors.textMuted}
          value={notes}
          onChangeText={t => setNotes(t.slice(0, 500))}
          maxLength={500}
          multiline
          numberOfLines={4}
        />

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={submit}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.submitBtnText}>Send Catering Request</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 60 },
  heading: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  subheading: { fontSize: 14, color: Colors.textSecondary, marginBottom: 24, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: Colors.text, marginBottom: 14,
  },
  inputMultiline: { height: 100, textAlignVertical: 'top' },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: Colors.background },
  successIcon: { fontSize: 56, marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: 10 },
  successBody: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24 },
});
