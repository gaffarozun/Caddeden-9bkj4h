// Powered by OnSpace.AI
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MAIN_CATEGORIES } from '@/services/categories';
import { MainCategoryId } from '@/services/categories';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';

interface MainCategoryTabsProps {
  value: MainCategoryId;
  onChange: (id: MainCategoryId) => void;
  variant?: 'card' | 'pill';
}

export function MainCategoryTabs({ value, onChange, variant = 'card' }: MainCategoryTabsProps) {
  if (variant === 'pill') {
    return (
      <View style={styles.pillRow}>
        {MAIN_CATEGORIES.map((m) => {
          const active = value === m.id;
          return (
            <Pressable
              key={m.id}
              onPress={() => onChange(m.id)}
              style={({ pressed }) => [styles.pill, active && styles.pillActive, pressed && { opacity: 0.9 }]}
            >
              <MaterialCommunityIcons
                name={m.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                size={15}
                color={active ? colors.white : colors.textSubtle}
              />
              <Text style={[styles.pillText, active && { color: colors.white }]} numberOfLines={1}>
                {m.short}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.cardRow}>
      {MAIN_CATEGORIES.map((m) => {
        const active = value === m.id;
        return (
          <Pressable
            key={m.id}
            onPress={() => onChange(m.id)}
            style={({ pressed }) => [
              styles.card,
              active ? { borderColor: m.color, backgroundColor: colors.surface } : styles.cardInactive,
              pressed && { opacity: 0.92 },
            ]}
          >
            <View style={[styles.cardIcon, { backgroundColor: active ? m.color : colors.surfaceTint }]}>
              <MaterialCommunityIcons
                name={m.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                size={22}
                color={active ? colors.white : colors.textSubtle}
              />
            </View>
            <Text style={[styles.cardLabel, active && { color: colors.text }]}>{m.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  cardRow: { flexDirection: 'row', gap: spacing.md },
  card: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.md,
    gap: spacing.sm,
    minHeight: 96,
    justifyContent: 'center',
  },
  cardInactive: { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  cardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textSubtle, lineHeight: fontSize.sm * 1.3 },
  pillRow: { flexDirection: 'row', gap: spacing.sm },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSubtle },
});
