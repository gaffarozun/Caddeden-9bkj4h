import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRatings } from '@/hooks/useRatings';
import { useTheme } from '@/hooks/useTheme';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
interface ExperienceAccessCardProps { businessId: string; isDemo?: boolean }
export const ExperienceAccessCard = memo(function ExperienceAccessCard({ businessId, isDemo = false }: ExperienceAccessCardProps) {
  const { experienceEnabled, experienceLoading } = useRatings();
  const { colors } = useTheme(); const styles = useMemo(() => createStyles(colors), [colors]); const router = useRouter();
  if (isDemo) return null;
  const locked = !experienceEnabled || experienceLoading;
  return <Pressable disabled={locked} accessibilityRole="button" accessibilityState={{ disabled: locked }} accessibilityLabel={locked ? 'Müşteri deneyimleri kapalı, yönetici onayı bekliyor' : 'Müşteri deneyimleri ve yorumları aç'} onPress={() => router.push(`/business/feedback/${businessId}`)} style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}>
    <MaterialCommunityIcons name={locked ? 'lock-outline' : 'comment-text-outline'} size={22} color={locked ? colors.textSubtle : colors.primaryDark} />
    <View style={styles.info}><Text style={styles.title}>Müşteri deneyimleri ve yorumlar</Text><Text style={styles.subtle}>{experienceLoading ? 'Özellik durumu kontrol ediliyor' : locked ? 'Şimdilik kapalı · Yönetici onayı bekliyor' : 'Yorumları, önerileri ve işletme cevaplarını gör'}</Text></View>
    <MaterialCommunityIcons name={locked ? 'lock-outline' : 'chevron-right'} size={20} color={colors.textSubtle} />
  </Pressable>;
});
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: { minHeight: spacing.xxxl, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTint },
  info: { flex: 1 },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text, includeFontPadding: false },
  subtle: { fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.6, color: colors.textSubtle, marginTop: spacing.xs },
  pressed: { opacity: 0.7 },
});
