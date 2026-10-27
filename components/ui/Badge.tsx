// Powered by OnSpace.AI
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { fontSize, fontWeight, radius, spacing } from '@/constants/theme';

interface BadgeProps {
  label: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'dark';
}

export function Badge({ label, tone = 'primary' }: BadgeProps) {
  const { colors } = useTheme();
  const TONES = {
    primary: { bg: colors.primarySoft, fg: colors.primaryDark },
    success: { bg: colors.successSoft, fg: colors.success },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    neutral: { bg: colors.surfaceTint, fg: colors.textSubtle },
    dark: { bg: colors.overlay, fg: colors.white },
  } as const;
  const toneStyle = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: toneStyle.bg }]}>
      <Text style={[styles.text, { color: toneStyle.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  text: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
});
