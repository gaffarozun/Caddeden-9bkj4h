// Powered by OnSpace.AI
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CATEGORIES } from '@/services/mockData';
import { CategoryId } from '@/services/types';
import { useTheme } from '@/hooks/useTheme';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';

interface CategoryBarProps {
  selected: CategoryId | 'all';
  onSelect: (id: CategoryId | 'all') => void;
  includeAll?: boolean;
}

export function CategoryBar({ selected, onSelect, includeAll = true }: CategoryBarProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const items: Array<{ id: CategoryId | 'all'; label: string; icon: string }> = [
    ...(includeAll ? [{ id: 'all' as const, label: 'Tümü', icon: 'view-grid' }] : []),
    ...CATEGORIES.map((c) => ({ id: c.id, label: c.label, icon: c.icon })),
  ];

  return (
    <View style={styles.outer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {items.map((item) => {
          const isSelected = selected === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => onSelect(item.id)}
              hitSlop={6}
              style={({ pressed }) => [
                styles.chip,
                isSelected ? styles.chipSelected : null,
                pressed && { opacity: 0.85 },
              ]}
            >
              <MaterialCommunityIcons
                name={item.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                size={16}
                color={isSelected ? colors.onPrimary : colors.textSubtle}
              />
              <Text style={[styles.label, { color: isSelected ? colors.onPrimary : colors.text }]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    outer: { minHeight: 44 },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 40,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
    },
    chipDefault: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  });
