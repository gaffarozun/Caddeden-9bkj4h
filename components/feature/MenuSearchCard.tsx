import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { MenuSearchResult } from '@/services/menuSearchService';
import { money } from '@/services/businessProfileService';
import { categoryLabel } from '@/services/categories';
import { useTheme } from '@/hooks/useTheme';
import { businessProfileLayout, fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';

interface MenuSearchCardProps { item: MenuSearchResult }
export const MenuSearchCard = memo(function MenuSearchCard({ item }: MenuSearchCardProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const score = item.ratingCount > 0 ? `${item.rating.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} · ${item.ratingCount} oy` : 'Henüz puan yok';
  return <View style={styles.card}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}, ${money(item.price)}, ${item.businessName}. Menüde gör.`}
      onPress={() => router.push({ pathname: '/business/menu/[id]', params: { id: item.businessId, itemId: item.id } })}
      style={({ pressed }) => [styles.product, pressed ? styles.pressed : null]}>
      {item.image ? <Image source={{ uri: item.image }} contentFit="cover" transition={200} style={styles.image} /> :
        <View style={[styles.image, styles.placeholder]}><MaterialCommunityIcons name="clipboard-text-outline" size={28} color={colors.primaryDark} /></View>}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.category} numberOfLines={1}>{item.group || categoryLabel(item.category)}{item.durationMin ? ` · ${item.durationMin} dk` : ''}</Text>
        <View style={styles.priceRow}><Text style={styles.price}>{money(item.price)}</Text><Text style={styles.menuLink}>Menüde gör</Text></View>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.primaryDark} />
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`${item.businessName} işletme profilini aç. İşletme puanı: ${score}.`}
      onPress={() => router.push(`/business/${item.businessId}`)} style={({ pressed }) => [styles.business, pressed ? styles.pressed : null]}>
      <View style={styles.businessName}><MaterialCommunityIcons name="storefront-outline" size={18} color={colors.textSubtle} /><Text style={styles.businessText} numberOfLines={2}>{item.businessName}</Text></View>
      <View style={styles.score}><MaterialCommunityIcons name="star-outline" size={18} color={colors.primaryDark} /><Text style={styles.scoreText}>{score}</Text></View>
    </Pressable>
  </View>;
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  product: { padding: spacing.md, minHeight: spacing.xxxl, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  image: { width: businessProfileLayout.menuImageSize, height: businessProfileLayout.menuImageSize, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: spacing.xs },
  name: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text, includeFontPadding: false },
  category: { fontSize: fontSize.sm, color: colors.textSubtle, includeFontPadding: false },
  priceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  price: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.primaryDark, includeFontPadding: false },
  menuLink: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSubtle },
  business: { minHeight: spacing.xxxl, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.primarySoft, borderTopWidth: 1, borderTopColor: colors.border },
  businessName: { flexDirection: 'row', alignItems: 'center', flexGrow: 1, flexShrink: 1, flexBasis: '50%', gap: spacing.sm },
  businessText: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.text, includeFontPadding: false },
  score: { flexDirection: 'row', alignItems: 'center', flexShrink: 0, gap: spacing.xs },
  scoreText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.primaryDark, includeFontPadding: false },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
