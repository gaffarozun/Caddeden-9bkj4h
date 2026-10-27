// Powered by OnSpace.AI
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { fontSize, fontWeight, spacing, ThemeColors } from '@/constants/theme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, right }: ScreenHeaderProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.wrap}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      marginBottom: spacing.lg,
      backgroundColor: colors.primarySoft,
      borderBottomWidth: 1,
      borderBottomColor: colors.brand,
    },
    title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.primaryDark, letterSpacing: -0.5 },
    subtitle: { fontSize: fontSize.sm, color: colors.textSubtle, marginTop: 2 },
  });
