// Powered by OnSpace.AI
// Shared UI building blocks for the admin + business panels.
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
import { useThemeStyles } from '@/hooks/useThemeStyles';

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'primary';

const createToneMap = (colors: ThemeColors): Record<Tone, { bg: string; fg: string }> => ({
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  neutral: { bg: colors.surfaceTint, fg: colors.textSubtle },
  info: { bg: colors.surfaceTint, fg: colors.info },
  primary: { bg: colors.primarySoft, fg: colors.primaryDark },
});

export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const { colors, styles } = useThemeStyles(createStyles);
  const t = createToneMap(colors)[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      <Text style={[styles.pillText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function AdminStat({
  icon,
  label,
  value,
  tone = 'primary',
}: {
  icon: string;
  label: string;
  value: string | number;
  tone?: Tone;
}) {
  const { colors, styles } = useThemeStyles(createStyles);
  const t = createToneMap(colors)[tone];
  return (
    <View style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: t.bg }]}>
        <MaterialCommunityIcons name={icon as keyof typeof MaterialCommunityIcons.glyphMap} size={20} color={t.fg} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function AdminCard({ children, style }: { children: React.ReactNode; style?: object }) {
  const { styles } = useThemeStyles(createStyles);
  return <View style={[styles.card, style]}>{children}</View>;
}

export function LinkRow({
  icon,
  title,
  subtitle,
  onPress,
  badge,
  tone = 'primary',
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  badge?: number;
  tone?: Tone;
}) {
  const { colors, styles } = useThemeStyles(createStyles);
  const t = createToneMap(colors)[tone];
  return (
    <Pressable style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]} onPress={onPress}>
      <View style={[styles.linkIcon, { backgroundColor: t.bg }]}>
        <MaterialCommunityIcons name={icon as keyof typeof MaterialCommunityIcons.glyphMap} size={22} color={t.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.linkTitle}>{title}</Text>
        {subtitle ? <Text style={styles.linkSub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {badge && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textFaint} />
    </Pressable>
  );
}

export function FilterTabs({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const { colors, styles } = useThemeStyles(createStyles);
  return (
    <View style={styles.tabs}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text style={[styles.tabText, active && { color: colors.onPrimary }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AdminEmpty({ icon = 'inbox-outline', text }: { icon?: string; text: string }) {
  const { colors, styles } = useThemeStyles(createStyles);
  return (
    <View style={styles.empty}>
      <MaterialCommunityIcons name={icon as keyof typeof MaterialCommunityIcons.glyphMap} size={44} color={colors.textFaint} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function AdminLoading({ label = 'Yükleniyor...' }: { label?: string }) {
  const { colors, styles } = useThemeStyles(createStyles);
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

export function SmallButton({
  label,
  icon,
  onPress,
  tone = 'primary',
  outline,
  disabled = false,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  tone?: Tone;
  outline?: boolean;
  disabled?: boolean;
}) {
  const { colors, styles } = useThemeStyles(createStyles);
  const t = createToneMap(colors)[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.smallBtn,
        outline
          ? { borderWidth: 1, borderColor: t.fg, backgroundColor: 'transparent' }
          : { backgroundColor: t.fg },
        (pressed || disabled) && { opacity: disabled ? 0.45 : 0.85 },
      ]}
    >
      {icon ? (
        <MaterialCommunityIcons
          name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
          size={15}
          color={outline ? t.fg : colors.onPrimary}
        />
      ) : null}
      <Text style={[styles.smallBtnText, { color: outline ? t.fg : colors.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  pillText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  stat: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  statLabel: { fontSize: fontSize.xs, color: colors.textSubtle },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  pressed: { opacity: 0.7 },
  linkIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  linkTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  linkSub: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: colors.onPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  tabs: { flexDirection: 'row', backgroundColor: colors.surfaceTint, borderRadius: radius.pill, padding: 4, gap: 4 },
  tab: { flex: 1, minHeight: spacing.xxxl, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textSubtle },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl, gap: spacing.md },
  emptyText: { fontSize: fontSize.sm, color: colors.textSubtle, textAlign: 'center' },
  loading: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl, gap: spacing.md },
  loadingText: { fontSize: fontSize.sm, color: colors.textSubtle },
  smallBtn: {
    minHeight: spacing.xxxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  smallBtnText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
});
