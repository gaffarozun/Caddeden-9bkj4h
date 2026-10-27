// Powered by OnSpace.AI
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MAIN_CATEGORIES, MainCategoryId } from '@/services/categories';
import { useTheme } from '@/hooks/useTheme';
import { fontSize, fontWeight, radius, shadow, spacing, ThemeColors } from '@/constants/theme';

interface MainCategoryTabsProps {
  selected: MainCategoryId;
  onSelect: (id: MainCategoryId) => void;
  counts?: Record<string, number>;
  compact?: boolean;
}

export function MainCategoryTabs({ selected, onSelect, counts, compact = false }: MainCategoryTabsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      {MAIN_CATEGORIES.map((m) => {
        const active = m.id === selected;
        const count = counts?.[m.id];
        return (
          <Pressable
            key={m.id}
            onPress={() => onSelect(m.id)}
            accessibilityRole="tab"
            accessibilityLabel={m.label}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.card,
              compact ? styles.compactCard : null,
              active ? { backgroundColor: colors.primarySoft, borderColor: colors.brand, borderWidth: 1 } : styles.cardDefault,
              active ? (shadow.md as object) : null,
              pressed && { opacity: 0.92 },
            ]}
          >
            <View
              style={[
                styles.iconWrap,
                compact ? styles.compactIcon : null,
                { backgroundColor: colors.surfaceTint },
              ]}
            >
              <MaterialCommunityIcons
                name={m.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                size={compact ? 20 : 24}
                color={colors.primaryDark}
              />
            </View>
            <Text
              style={[styles.label, compact ? styles.compactLabel : null, { color: active ? colors.primaryDark : colors.text }]}
              numberOfLines={2}
            >
              {m.label}
            </Text>
            {typeof count === 'number' ? (
              <Text
                style={[
                  styles.count,
                  { color: colors.textSubtle },
                ]}
              >
                {count} işletme
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg },
    card: {
      flex: 1,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
      minHeight: 116,
      justifyContent: 'center',
    },
    compactCard: { minHeight: spacing.xxxl + spacing.md, flexDirection: 'row', alignItems: 'center', padding: spacing.sm },
    compactIcon: { width: spacing.xxl, height: spacing.xxl, borderRadius: radius.sm },
    compactLabel: { flex: 1, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.4 },
    cardDefault: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: { fontSize: fontSize.md, fontWeight: fontWeight.bold, lineHeight: fontSize.md * 1.25 },
    count: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  });
