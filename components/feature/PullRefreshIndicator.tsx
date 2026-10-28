import React, { memo, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing, ThemeColors } from '@/constants/theme';

// Web'de aşağı çekme sırasında listenin üstünde beliren küçük gösterge (düğme değildir).
export const PullRefreshIndicator = memo(function PullRefreshIndicator({ pull, refreshing, top = 0 }: { pull: number; refreshing: boolean; top?: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!refreshing && pull <= 4) return null;
  const shift = refreshing ? 12 : Math.min(pull, 80) - 36;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top, transform: [{ translateY: shift }] }]} accessibilityLiveRegion="polite" accessibilityLabel={refreshing ? 'Yenileniyor' : 'Yenilemek için bırakın'}>
      {refreshing ? <ActivityIndicator size="small" color={colors.primary} />
        : <MaterialCommunityIcons name="arrow-down" size={20} color={colors.primary} style={{ transform: [{ rotate: pull >= 64 ? '180deg' : '0deg' }] }} />}
    </View>
  );
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: { position: 'absolute', alignSelf: 'center', zIndex: 20, width: spacing.xxxl, height: spacing.xxxl, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
});
