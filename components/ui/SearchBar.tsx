// Powered by OnSpace.AI
import React, { useMemo } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { fontSize, radius, spacing, ThemeColors } from '@/constants/theme';

interface SearchBarProps {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  label?: string;
  maxLength?: number;
}

export function SearchBar({ value, onChangeText, placeholder, label, maxLength }: SearchBarProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.wrap}>
      <MaterialCommunityIcons name="magnify" size={20} color={colors.textFaint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? 'İşletme veya kategori ara'}
        placeholderTextColor={colors.textFaint}
        style={styles.input}
        returnKeyType="search"
        accessibilityLabel={label ?? 'Arama'}
        maxLength={maxLength}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      height: 46,
    },
    input: {
      flex: 1,
      fontSize: fontSize.md,
      color: colors.text,
      padding: 0,
    },
  });
