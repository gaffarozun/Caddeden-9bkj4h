import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { darkColors, lightColors, mustardColors, pinkColors, fontSize, fontWeight, radius, spacing, ThemeColors, ThemeMode } from '@/constants/theme';

const palettes = [
  { id: 'mustard', label: 'Turuncu · Hardal', palette: mustardColors },
  { id: 'dark', label: 'Koyu', palette: darkColors },
  { id: 'light', label: 'Açık', palette: lightColors },
  { id: 'pink', label: 'Toz pembe', palette: pinkColors },
] as const;
interface AppearanceSettingsProps { compact?: boolean }
export const AppearanceSettings = memo(function AppearanceSettings(_props: AppearanceSettingsProps) {
  const { colors, styles, mode, resolvedMode, setMode, preferenceError, ready } = useThemeStyles(createStyles);
  const choose = (next: ThemeMode) => setMode(next);
  return <View style={styles.card}>
    <View style={styles.row}><MaterialCommunityIcons name="palette-outline" size={22} color={colors.primary} /><View style={styles.info}><Text style={styles.title}>Görünüm</Text><Text style={styles.subtle}>Aktif tema: {palettes.find(item => item.id === resolvedMode)?.label}</Text></View></View>
    <Text style={styles.subtle}>Kadın, erkek, kullanıcı, işletme ve yönetici hesaplarında varsayılan tema açıktır. Seçtiğiniz diğer temalar hesabınız için korunur.</Text>
    <View style={styles.previews}>{palettes.map(item => {
      const selected = mode === item.id;
      return <Pressable key={item.id} disabled={!ready} accessibilityRole="button" accessibilityLabel={`${item.label} tema`} accessibilityState={{ selected, disabled: !ready }} onPress={() => choose(item.id)} style={({ pressed }) => [styles.choice, selected ? styles.selected : null, pressed ? styles.pressed : null]}>
        <View style={[styles.preview, { backgroundColor: item.palette.background }]}>
          <View style={[styles.previewCover, { backgroundColor: item.palette.brand }]} />
          <View style={[styles.previewLine, { backgroundColor: item.palette.text }]} />
          <View style={[styles.previewLineShort, { backgroundColor: item.palette.textSubtle }]} />
          <View style={[styles.previewButton, { borderColor: item.palette.brand, backgroundColor: item.palette.surface }]} />
        </View>
        <Text style={[styles.label, selected ? styles.activeLabel : null]}>{item.label}</Text>
        {selected ? <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.primary} /> : <View style={styles.checkSpace} />}
      </Pressable>;
    })}</View>
    <View style={styles.row}>{([{ id: 'auto', label: 'Varsayılan', icon: 'account-outline' }, { id: 'system', label: 'Cihaz teması', icon: 'theme-light-dark' }] as const).map(item => <Pressable key={item.id} disabled={!ready} accessibilityRole="button" accessibilityState={{ selected: mode === item.id, disabled: !ready }} onPress={() => choose(item.id)} style={({ pressed }) => [styles.mode, mode === item.id ? styles.modeSelected : null, pressed ? styles.pressed : null]}><MaterialCommunityIcons name={item.icon} size={18} color={mode === item.id ? colors.primaryDark : colors.textSubtle} /><Text style={styles.label}>{item.label}</Text></Pressable>)}</View>
    {preferenceError ? <View style={styles.row} accessibilityLiveRegion="polite"><MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.danger} /><Text style={[styles.body, styles.info, { color: colors.danger }]}>{preferenceError}</Text></View> : null}
  </View>;
});
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: { padding: spacing.lg, gap: spacing.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, borderRadius: radius.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, info: { flex: 1 },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text, includeFontPadding: false },
  body: { fontSize: fontSize.md, lineHeight: fontSize.md * 1.6, color: colors.textSubtle },
  subtle: { fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.6, color: colors.textSubtle },
  previews: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: { flexGrow: 1, flexBasis: '45%', minHeight: spacing.xxxl, alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  preview: { width: '100%', height: 100, borderRadius: radius.sm, padding: spacing.sm, gap: spacing.sm, overflow: 'hidden' },
  previewCover: { height: 28, borderRadius: spacing.xs }, previewLine: { height: spacing.xs, width: '80%', borderRadius: spacing.xs }, previewLineShort: { height: spacing.xs, width: '55%', borderRadius: spacing.xs },
  previewButton: { height: 20, borderRadius: spacing.xs, borderWidth: 1 },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, includeFontPadding: false }, activeLabel: { color: colors.primaryDark }, checkSpace: { height: 18 },
  mode: { flex: 1, minHeight: spacing.xxxl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  modeSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
});
