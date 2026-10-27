// Powered by OnSpace.AI
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fontWeight } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface AvatarProps {
  name: string;
  size?: number;
}

export function Avatar({ name, size = 44 }: AvatarProps) {
  const { colors } = useTheme();
  const initials = name
    .trim()
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
  const bg = colors.primarySoft;

  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, borderWidth: 1, borderColor: colors.brand },
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.4, color: colors.primaryDark }]}>{initials || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: fontWeight.bold },
});
