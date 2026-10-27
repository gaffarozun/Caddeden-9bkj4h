// Powered by OnSpace.AI
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MainCategoryId, getMainCategory, subCategoriesOf } from '@/services/categories';
import { useTheme } from '@/hooks/useTheme';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';

interface SubCategoryBarProps {
  main: MainCategoryId;
  selected: string;
  onSelect: (id: string) => void;
}

export function SubCategoryBar({ main, selected, onSelect }: SubCategoryBarProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const mainColor = colors.primary;
  const items: Array<{ id: string; label: string; icon: string }> = [
    { id: 'all', label: 'Tümü', icon: 'view-grid' },
    ...subCategoriesOf(main).map((s) => ({ id: s.id, label: s.label, icon: s.icon })),
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
                isSelected
                  ? { backgroundColor: mainColor, borderColor: mainColor }
                  : styles.chipDefault,
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
      height: 38,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chipDefault: { backgroundColor: colors.surface, borderColor: colors.border },
    label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  });
