import React, { memo, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { createFeedbackStyles } from '@/constants/feedbackStyles';
import { fontSize, spacing } from '@/constants/theme';

interface FeedbackButtonProps { compact?: boolean; label: string; onPress: () => void; disabled?: boolean; busy?: boolean; secondary?: boolean; danger?: boolean; icon?: keyof typeof MaterialCommunityIcons.glyphMap }
export const FeedbackButton = memo(function FeedbackButton({ label, onPress, disabled, busy, secondary, danger, icon, compact = false }: FeedbackButtonProps) {
  const { colors } = useTheme(); const styles = useMemo(() => createFeedbackStyles(colors), [colors]);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled || !!busy }} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [styles.button, compact ? compactStyles.button : null, secondary ? styles.secondary : null, danger ? styles.danger : null, disabled || busy ? styles.disabled : null, pressed ? styles.pressed : null]}>
    {busy ? <ActivityIndicator color={colors.text} /> : icon ? <MaterialCommunityIcons name={icon} size={20} color={secondary || danger ? colors.text : colors.primaryDark} /> : null}
    <Text style={[styles.buttonText, compact ? compactStyles.text : null, secondary || danger ? styles.secondaryText : null]}>{label}</Text>
  </Pressable>;
});
const compactStyles = StyleSheet.create({
  button: { minHeight: spacing.xxxl, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  text: { fontSize: fontSize.sm, flexShrink: 1, textAlign: 'center', includeFontPadding: false },
});
interface FeedbackChipsProps { items: readonly { id: string; label: string }[]; selected: string; onSelect: (id: string) => void; label: string; disabled?: boolean; compact?: boolean; hideLabel?: boolean }
export const FeedbackChips = memo(function FeedbackChips({ items, selected, onSelect, label, disabled, compact = false, hideLabel = false }: FeedbackChipsProps) {
  const { colors } = useTheme(); const styles = useMemo(() => createFeedbackStyles(colors), [colors]);
  return <View style={styles.section}>
    {!hideLabel ? <Text style={styles.label}>{label}</Text> : null}
    <View style={[styles.chipOuter, compact ? styles.compactChipOuter : null]}><FlatList horizontal accessibilityLabel={label} data={items} keyExtractor={item => item.id} contentContainerStyle={[styles.chipRow, compact ? styles.compactChipRow : null]} showsHorizontalScrollIndicator={false} renderItem={({ item }) => <Pressable disabled={disabled} hitSlop={compact ? { top: spacing.md / 2, bottom: spacing.md / 2 } : undefined} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: item.id === selected, disabled: !!disabled }} onPress={() => onSelect(item.id)} style={({ pressed }) => [styles.chip, compact ? styles.compactChip : null, item.id === selected ? styles.chipActive : null, pressed ? styles.pressed : null]}><Text style={[styles.chipText, compact ? styles.compactChipText : null, item.id === selected ? styles.chipTextActive : null]}>{item.label}</Text></Pressable>} /></View>
  </View>;
});
interface FeedbackInputProps { label: string; value: string; onChange: (value: string) => void; maxLength?: number; secure?: boolean; multiline?: boolean; disabled?: boolean; placeholder?: string; autoFocus?: boolean }
export const FeedbackInput = memo(function FeedbackInput({ label, value, onChange, maxLength = 2000, secure, multiline = true, disabled, placeholder, autoFocus = false }: FeedbackInputProps) {
  const { colors } = useTheme(); const styles = useMemo(() => createFeedbackStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);
  return <View style={styles.section}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} maxLength={maxLength} secureTextEntry={secure} multiline={multiline} editable={!disabled} autoFocus={autoFocus} placeholder={placeholder} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} autoCapitalize={secure ? 'none' : 'sentences'} autoCorrect={!secure} style={[styles.input, multiline ? styles.multiline : null, focused ? styles.inputFocused : null]} placeholderTextColor={colors.textSubtle} />{multiline ? <Text style={styles.subtle}>{value.length} / {maxLength}</Text> : null}</View>;
});
export const FeedbackError = memo(function FeedbackError({ message }: { message: string }) {
  const { colors } = useTheme(); const styles = useMemo(() => createFeedbackStyles(colors), [colors]);
  if (!message) return null;
  return <View style={styles.error} accessibilityRole="alert"><MaterialCommunityIcons name="alert-circle-outline" size={22} color={colors.text} /><Text style={styles.errorText}>{message}</Text></View>;
});
interface FeedbackStarsProps { rating: number; onChange: (rating: number) => void; disabled?: boolean; label?: string }
export const FeedbackStars = memo(function FeedbackStars({ rating, onChange, disabled, label = 'Puanınız' }: FeedbackStarsProps) {
  const { colors } = useTheme(); const styles = useMemo(() => createFeedbackStyles(colors), [colors]);
  return <View style={styles.criteriaField}><View style={styles.criteriaLabelRow}><Text style={styles.label}>{label}</Text><Text style={styles.criteriaCount}>{rating ? `${rating} / 5` : 'Seçin'}</Text></View><View style={styles.starRow}>{[1, 2, 3, 4, 5].map(value => <Pressable key={value} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${label}: ${value} yıldız`} accessibilityState={{ selected: rating === value, disabled: !!disabled }} onPress={() => onChange(value)} style={({ pressed }) => [styles.starButton, disabled ? styles.disabled : null, pressed ? styles.pressed : null]}><MaterialCommunityIcons name={value <= rating ? 'star' : 'star-outline'} size={24} color={value <= rating ? colors.primaryDark : colors.textSubtle} /></Pressable>)}</View></View>;
});
