import React, { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';

interface FeedRefreshButtonProps { refreshing: boolean; onRefresh: () => void }
export const FeedRefreshButton = memo(function FeedRefreshButton({ refreshing, onRefresh }: FeedRefreshButtonProps) {
  const { colors, styles } = useThemeStyles(createStyles);
  return <Pressable accessibilityRole="button" accessibilityLabel={refreshing ? 'İçerikler yenileniyor' : 'İçerikleri yenile'} accessibilityState={{ disabled: refreshing, busy: refreshing }} disabled={refreshing} onPress={onRefresh} style={({ pressed }) => [styles.button, pressed ? styles.pressed : null, refreshing ? styles.disabled : null]}>
    {refreshing ? <ActivityIndicator size="small" color={colors.primaryDark} /> : <MaterialCommunityIcons name="refresh" size={20} color={colors.primaryDark} />}
    <Text style={styles.label}>{refreshing ? 'Yükleniyor' : 'Yenile'}</Text>
  </Pressable>;
});
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  button: { minHeight: spacing.xxxl, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.primaryDark, includeFontPadding: false },
  pressed: { opacity: 0.72 }, disabled: { opacity: 0.7 },
});
