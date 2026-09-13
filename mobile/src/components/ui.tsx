/**
 * Shared building blocks for screens that mirror a website page. The web uses
 * Tailwind's neutral scale + brand red; these reproduce those same tokens so
 * an app screen and its web page read as the same product.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Image, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

// Tailwind neutral / accent values the web pages use, for one-off styling.
export const T = {
  n50: '#FAFAFA', n100: '#F5F5F5', n200: '#E5E5E5', n300: '#D4D4D4', n400: '#A3A3A3',
  n500: '#737373', n600: '#525252', n700: '#404040', n800: '#262626', n900: '#171717',
  orange: '#F5A623', star: '#F5A623',
  green50: '#F0FDF4', green500: '#22C55E', green600: '#16A34A', green700: '#15803D',
  amber50: '#FFFBEB', amber100: '#FEF3C7', amber400: '#FBBF24', amber500: '#F59E0B', amber700: '#B45309', amber800: '#92400E',
  blue50: '#EFF6FF', blue400: '#60A5FA', blue500: '#3B82F6', blue600: '#2563EB',
  red50: '#FEF2F2', red100: '#FEE2E2', red400: '#F87171', red500: '#EF4444', red600: '#DC2626',
  yellow50: '#FEFCE8', yellow700: '#A16207',
  orange50: '#FFF7ED', orange400: '#FB923C', orange600: '#EA580C',
};

export const shadow: ViewStyle = {
  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
};

/** Dark banner used at the top of most web pages. */
export function Hero({ emoji, title, subtitle, children }: {
  emoji?: string; title: string; subtitle?: string; children?: ReactNode;
}) {
  return (
    <View style={s.hero}>
      {emoji ? <Text style={s.heroEmoji}>{emoji}</Text> : null}
      <Text style={s.heroTitle}>{title}</Text>
      {subtitle ? <Text style={s.heroSubtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

/** White header strip used by lighter pages (events, city, social). */
export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={s.pageHeader}>
      <View style={{ flex: 1 }}>
        <Text style={s.pageHeaderTitle}>{title}</Text>
        {subtitle ? <Text style={s.pageHeaderSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function SectionLabel({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.sectionLabel, style]}>{typeof children === 'string' ? children.toUpperCase() : children}</Text>;
}

export function Pill({ label, active, onPress, activeColor = Colors.primary, count, style }: {
  label: string; active: boolean; onPress: () => void; activeColor?: string; count?: number; style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[s.pill, active ? { backgroundColor: activeColor } : s.pillIdle, style]}
    >
      <Text style={[s.pillText, active ? { color: '#fff' } : { color: T.n600 }]}>{label}</Text>
      {count !== undefined && (
        <View style={[s.pillCount, active ? { backgroundColor: 'rgba(255,255,255,0.2)' } : { backgroundColor: T.n100 }]}>
          <Text style={[s.pillCountText, { color: active ? '#fff' : T.n500 }]}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }} accessibilityLabel={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Text key={n} style={{ fontSize: size, color: n <= rating ? T.star : T.n200 }}>★</Text>
      ))}
    </View>
  );
}

export function Button({ title, onPress, disabled, loading, variant = 'primary', style, small }: {
  title: string; onPress: () => void; disabled?: boolean; loading?: boolean;
  variant?: 'primary' | 'dark' | 'outline' | 'ghost' | 'green' | 'blue' | 'danger'; style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const bg = {
    primary: Colors.primary, dark: T.n800, outline: 'transparent', ghost: T.n100,
    green: T.green500, blue: T.blue500, danger: T.red100,
  }[variant];
  const fg = { primary: '#fff', dark: '#fff', outline: T.n600, ghost: T.n600, green: '#fff', blue: '#fff', danger: T.red600 }[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading) }}
      style={[
        s.button,
        small && s.buttonSmall,
        { backgroundColor: bg },
        variant === 'outline' && s.buttonOutline,
        (disabled || loading) && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : (
        <Text style={[s.buttonText, small && s.buttonTextSmall, { color: fg }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

export function Field({ label, hint, error, children, right }: {
  label: string; hint?: string; error?: string | null; children: ReactNode; right?: ReactNode;
}) {
  return (
    <View style={s.field}>
      <View style={s.fieldLabelRow}>
        <Text style={s.fieldLabel}>{label}</Text>
        {right}
      </View>
      {children}
      {error ? <Text style={s.fieldError}>{error}</Text> : hint ? <Text style={s.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function Input(props: TextInputProps & { invalid?: boolean }) {
  const { style, invalid, multiline, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={T.n400}
      multiline={multiline}
      style={[s.input, multiline && s.inputMultiline, invalid && { borderColor: T.red400 }, style]}
      {...rest}
    />
  );
}

export function ToggleRow({ label, description, value, onValueChange, disabled, last }: {
  label: string; description?: string; value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean; last?: boolean;
}) {
  return (
    <View style={[s.toggleRow, !last && s.rowDivider]}>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleLabel}>{label}</Text>
        {description ? <Text style={s.toggleDesc}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: Colors.primary, false: T.n200 }}
        thumbColor="#fff"
        ios_backgroundColor={T.n200}
        accessibilityLabel={label}
      />
    </View>
  );
}

export function LoadingState({ label }: { label?: string }) {
  return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={Colors.primary} />
      {label ? <Text style={s.centerText}>{label}</Text> : null}
    </View>
  );
}

export function ErrorState({ title, message, onRetry }: { title: string; message?: string; onRetry?: () => void }) {
  return (
    <View style={s.center}>
      <Text style={s.centerTitle}>{title}</Text>
      {message ? <Text style={s.centerText}>{message}</Text> : null}
      {onRetry && <Button title="Retry" onPress={onRetry} style={{ marginTop: 16, alignSelf: 'center' }} small />}
    </View>
  );
}

export function EmptyState({ icon, title, message, action, dashed }: {
  icon?: IconName; title: string; message?: string; action?: ReactNode; dashed?: boolean;
}) {
  return (
    <View style={[s.empty, dashed && s.emptyDashed]}>
      {icon ? (
        <View style={s.emptyIcon}><Ionicons name={icon} size={26} color={T.n300} /></View>
      ) : null}
      <Text style={s.emptyTitle}>{title}</Text>
      {message ? <Text style={s.emptyText}>{message}</Text> : null}
      {action ? <View style={{ marginTop: 16 }}>{action}</View> : null}
    </View>
  );
}

/** Square/round truck photo with the web's grey truck placeholder. */
export function TruckPhoto({ uri, size, radius = 12, dark }: { uri?: string | null; size: number; radius?: number; dark?: boolean }) {
  const valid = typeof uri === 'string' && uri.trim().length > 0 ? uri.trim() : null;
  return valid ? (
    <Image source={{ uri: valid }} style={{ width: size, height: size, borderRadius: radius, backgroundColor: T.n100 }} resizeMode="cover" />
  ) : (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: dark ? T.n800 : T.n200, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="bus-outline" size={Math.round(size * 0.42)} color={dark ? T.n600 : '#BBBBBB'} />
    </View>
  );
}

/** Rows of label → value, like the web's definition-list cards. */
export function InfoRows({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <View>
      {rows.map((r, i) => (
        <View key={r.label} style={[s.infoRow, i < rows.length - 1 && s.rowDivider]}>
          <Text style={s.infoLabel}>{r.label.toUpperCase()}</Text>
          {typeof r.value === 'string' ? <Text style={s.infoValue}>{r.value}</Text> : r.value}
        </View>
      ))}
    </View>
  );
}

export type ToastState = { msg: string; isError?: boolean } | null;

/** Bottom toast matching the web dashboards' — call show(msg, isError). */
export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => {
    mounted.current = false;
    if (timer.current) clearTimeout(timer.current);
  }, []);
  function show(msg: string, isError = true) {
    if (!mounted.current) return;
    if (timer.current) clearTimeout(timer.current);
    setToast({ msg, isError });
    timer.current = setTimeout(() => { if (mounted.current) setToast(null); }, 4000);
  }
  return { toast, show };
}

export function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  return (
    <View pointerEvents="none" style={[s.toast, { backgroundColor: toast.isError ? T.n900 : T.green600 }]} accessibilityLiveRegion="polite">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={toast.isError ? 'alert-circle' : 'checkmark-circle'} size={16} color="#fff" />
        <Text style={s.toastText}>{toast.msg}</Text>
      </View>
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.n100 },
  hero: { backgroundColor: T.n900, paddingHorizontal: 20, paddingVertical: 28, alignItems: 'center' },
  heroEmoji: { fontSize: 30, marginBottom: 8 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#fff', textAlign: 'center', letterSpacing: 0.3 },
  heroSubtitle: { fontSize: 14, color: T.n400, marginTop: 6, textAlign: 'center', lineHeight: 20, maxWidth: 320 },
  pageHeader: {
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: T.n100,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  pageHeaderTitle: { fontSize: 20, fontWeight: '900', color: T.n900 },
  pageHeaderSubtitle: { fontSize: 13, color: T.n400, marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, ...shadow },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4, color: T.n400, marginBottom: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  pillIdle: { backgroundColor: T.n100 },
  pillText: { fontSize: 12, fontWeight: '700' },
  pillCount: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  pillCountText: { fontSize: 10, fontWeight: '900' },
  button: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  buttonSmall: { borderRadius: 12, paddingVertical: 9, paddingHorizontal: 14 },
  buttonOutline: { borderWidth: 2, borderColor: T.n300 },
  buttonText: { fontSize: 15, fontWeight: '900' },
  buttonTextSmall: { fontSize: 13, fontWeight: '800' },
  field: { marginBottom: 16 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: T.n700 },
  fieldHint: { fontSize: 12, color: T.n400, marginTop: 5 },
  fieldError: { fontSize: 12, color: T.red500, marginTop: 5 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: T.n200, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: T.n900,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: T.n800 },
  toggleDesc: { fontSize: 12, color: T.n400, marginTop: 2 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: T.n100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 6 },
  centerTitle: { fontSize: 16, fontWeight: '700', color: T.n700, textAlign: 'center' },
  centerText: { fontSize: 14, color: T.n400, textAlign: 'center', marginTop: 6 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyDashed: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: T.n200 },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: T.n100, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: T.n700, textAlign: 'center' },
  emptyText: { fontSize: 13, color: T.n400, textAlign: 'center', marginTop: 4, lineHeight: 19, maxWidth: 300 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, paddingVertical: 12 },
  infoLabel: { fontSize: 11, fontWeight: '900', color: T.n400, letterSpacing: 0.6, paddingTop: 2 },
  infoValue: { fontSize: 14, color: T.n700, fontWeight: '500', textAlign: 'right', flex: 1 },
  toast: {
    position: 'absolute', bottom: 28, left: 24, right: 24, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 13,
    alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
});
