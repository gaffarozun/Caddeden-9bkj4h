import React, { memo, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing, ThemeColors } from '@/constants/theme';

interface RefreshButtonProps {
  onPress: () => void;
  refreshing: boolean;
  label?: string;
}

// Web'de ekranı aşağı çekerek yenileme çalışmaz; bu düğme her platformda yenilemeyi tek dokunuşla yapar.
export const RefreshButton = memo(function RefreshButton({ onPress, refreshing, label = 'Sayfayı yenile' }: RefreshButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={refreshing ? 'Yenileniyor' : label}
      accessibilityState={{ disabled: refreshing, busy: refreshing }}
      disabled={refreshing}
      onPress={onPress}
      hitSlop={spacing.xs}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
    >
      {refreshing
        ? <ActivityIndicator size="small" color={colors.primaryDark} />
        : <MaterialCommunityIcons name="refresh" size={22} color={colors.primaryDark} />}
    </Pressable>
  );
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  button: { width: spacing.xxxl, height: spacing.xxxl, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pressed: { opacity: 0.7 },
});
