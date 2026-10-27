import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { businessProfileLayout, fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
import { useThemeStyles } from '@/hooks/useThemeStyles';
interface CampaignCardProps { id: string; businessId: string; title: string; description?: string; name: string; category: string; cover: string }
export const CampaignCard = memo(function CampaignCard({ businessId, title, description, name }: CampaignCardProps) {
  const { colors: c, styles } = useThemeStyles(createStyles);
  const router = useRouter();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${name}, ${title}`} onPress={() => router.push(`/business/${businessId}`)} style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}><View style={styles.icon}><MaterialCommunityIcons name="percent-outline" size={23} color={c.danger} /></View><View style={styles.info}><Text style={styles.title} numberOfLines={1}>{title}</Text><Text style={styles.description} numberOfLines={1}>{description || name}</Text></View><MaterialCommunityIcons name="chevron-right" size={22} color={c.textSubtle} /></Pressable>;
});
const createStyles = (c: ThemeColors) => StyleSheet.create({
  card: { width: 288, minHeight: businessProfileLayout.campaignHeight, borderRadius: radius.md, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  icon: { width: spacing.xxl, height: spacing.xxl, borderRadius: radius.pill, backgroundColor: c.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: spacing.xs }, title: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text }, description: { fontSize: fontSize.sm, color: c.textSubtle }, pressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
});
