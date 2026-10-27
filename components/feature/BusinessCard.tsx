// Discovery cards share the business profile material, brand outline and status colors.
import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Business } from '@/services/types';
import { getSubCategory } from '@/services/categories';
import { getOpenStatus } from '@/services/businessStatus';
import { useApp } from '@/hooks/useApp';
import { useTheme } from '@/hooks/useTheme';
import { Badge } from '@/components/ui/Badge';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
interface BusinessCardProps { business: Business }
export const BusinessCard = memo(function BusinessCard({ business }: BusinessCardProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, savedBusinessIds, toggleSaveBusiness } = useApp();
  const saved = savedBusinessIds.includes(business.id);
  const category = getSubCategory(business.category);
  const status = getOpenStatus(business);
  const isDemo = !/^[0-9a-f-]{36}$/i.test(business.id);
  const distance = business.distanceKm >= 0 && Number.isFinite(business.distanceKm) && !isDemo && business.lat != null && business.lng != null && (business.distanceKm > 0 || business.distanceMeasured) ? business.distanceKm < 1 ? `${Math.round(business.distanceKm * 1000)} m` : `${business.distanceKm.toFixed(1)} km` : '';
  return <Pressable accessibilityRole="button" accessibilityLabel={`${business.name}, ${status.open ? 'açık' : 'kapalı'}`} onPress={() => router.push(`/business/${business.id}`)} style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}>
    <View style={styles.imageWrap}>
      {business.cover ? <Image source={{ uri: business.cover }} style={styles.image} contentFit="cover" transition={200} /> : <MaterialCommunityIcons name="storefront-outline" size={32} color={colors.primary} />}
      {isDemo ? <View style={styles.demo}><Text style={styles.demoText}>Demo</Text></View> : null}
    </View>
    <View style={styles.body}>
      <View style={styles.topRow}><Text style={styles.name} numberOfLines={2}>{business.name}</Text>{user.type !== 'business' ? <Pressable accessibilityRole="button" accessibilityLabel={saved ? 'İşletmeyi kayıttan çıkar' : 'İşletmeyi kaydet'} accessibilityState={{ selected: saved }} onPress={event => { event.stopPropagation(); toggleSaveBusiness(business.id); }} style={({ pressed }) => [styles.save, pressed ? styles.pressed : null]}><MaterialCommunityIcons name={saved ? 'bookmark' : 'bookmark-outline'} size={22} color={saved ? colors.primary : colors.textSubtle} /></Pressable> : null}</View>
      <View style={styles.metaRow}><MaterialCommunityIcons name="star" size={16} color={colors.primary} /><Text style={styles.rating}>{business.reviewCount || isDemo ? Number(business.rating).toFixed(1) : '—'}</Text><Text style={styles.meta}>{business.reviewCount ? `(${business.reviewCount})` : isDemo ? '' : 'Henüz puan yok'}</Text></View>
      <Text style={styles.meta} numberOfLines={1}>{category?.label ?? 'İşletme'}{distance ? ` · ${distance}` : ''}</Text>
      {business.allowOrder ? <Text style={styles.meta}>Min. {business.minOrder ?? 0} ₺{business.avgDeliveryMinutes ? ` · ~${business.avgDeliveryMinutes} dk` : ''}</Text> : null}
      <View style={styles.bottomRow}><View style={styles.statusRow}><View style={[styles.statusDot, { backgroundColor: status.open ? colors.success : colors.danger }]} /><Text style={[styles.status, { color: status.open ? colors.success : colors.danger }]}>{status.open ? 'Açık' : 'Kapalı'}</Text></View>{business.campaign ? <View style={styles.campaign}><Badge label={business.campaign} tone="primary" /></View> : null}</View>
    </View>
  </Pressable>;
});
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, gap: spacing.md, overflow: 'hidden' },
  imageWrap: { width: 96, minHeight: 124, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceTint, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%', position: 'absolute' },
  demo: { position: 'absolute', bottom: spacing.sm, left: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: colors.overlayStrong, borderRadius: radius.sm },
  demoText: { fontSize: fontSize.xs, color: colors.white, fontWeight: fontWeight.medium },
  body: { flex: 1, gap: spacing.xs, paddingVertical: spacing.xs, minWidth: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  name: { flex: 1, fontSize: fontSize.lg, color: colors.text, fontWeight: fontWeight.semibold, includeFontPadding: false },
  save: { minHeight: spacing.xxxl, minWidth: spacing.xxxl, justifyContent: 'center', alignItems: 'center', marginRight: -spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  rating: { fontSize: fontSize.md, color: colors.primaryDark, fontWeight: fontWeight.semibold },
  meta: { fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5, color: colors.textSubtle },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.xs },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, statusDot: { width: spacing.sm, height: spacing.sm, borderRadius: radius.pill },
  status: { fontSize: fontSize.sm, fontWeight: fontWeight.medium }, campaign: { flexShrink: 1 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
});
