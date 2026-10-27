import React, { memo } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBusinessTheme } from '@/hooks/useBusinessTheme';
type Icon = keyof typeof MaterialCommunityIcons.glyphMap;
interface BusinessLinkProps { label: string; icon: Icon; onPress: () => void; featured?: boolean; disabled?: boolean }
export const BusinessLink = memo(function BusinessLink({ label, icon, onPress, featured = false, disabled = false }: BusinessLinkProps) {
  const { colors: c, styles: s } = useBusinessTheme();
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }} style={({ pressed }) => [s.linkButton, featured ? s.featuredButton : null, disabled ? s.disabled : null, pressed ? s.pressed : null]}><MaterialCommunityIcons name={icon} color={featured ? c.primary : c.textSubtle} size={22} /><Text style={[s.linkLabel, featured ? s.gold : null]}>{label}</Text><MaterialCommunityIcons name="chevron-right" color={featured ? c.primary : c.textSubtle} size={22} /></Pressable>;
});
interface BusinessActionProps { label: string; icon: Icon; selected?: boolean; onPress: () => void }
export const BusinessAction = memo(function BusinessAction({ label, icon, selected, onPress }: BusinessActionProps) {
  const { colors: c, styles: s } = useBusinessTheme();
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [s.action, pressed ? s.pressed : null]}><MaterialCommunityIcons name={icon} size={23} color={selected ? c.primary : c.text} /><Text style={[s.actionLabel, selected ? s.gold : null]}>{label}</Text></Pressable>;
});
interface BusinessHeaderProps { title: string; onBack: () => void }
export const BusinessHeader = memo(function BusinessHeader({ title, onBack }: BusinessHeaderProps) {
  const { colors: c, styles: s } = useBusinessTheme();
  return <View style={s.header}><Pressable accessibilityLabel="Geri dön" accessibilityRole="button" onPress={onBack} style={({ pressed }) => [s.headerSide, pressed ? s.pressed : null]}><MaterialCommunityIcons name="chevron-left" size={30} color={c.text} /></Pressable><Text style={s.headerTitle}>{title}</Text><View style={s.headerSide} /></View>;
});
interface BusinessPrimaryProps { label: string; onPress: () => void; busy?: boolean; disabled?: boolean }
export const BusinessPrimary = memo(function BusinessPrimary({ label, onPress, busy = false, disabled = false }: BusinessPrimaryProps) {
  const { colors: c, styles: s } = useBusinessTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy }} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [s.primaryButton, disabled ? s.disabled : null, pressed ? s.pressed : null]}>{busy ? <ActivityIndicator color={c.onPrimary} /> : <Text style={s.primaryLabel}>{label}</Text>}</Pressable>;
});
interface BusinessErrorProps { message: string }
export const BusinessError = memo(function BusinessError({ message }: BusinessErrorProps) {
  const { colors: c, styles: s } = useBusinessTheme();
  return message ? <View style={s.error} accessibilityLiveRegion="polite"><MaterialCommunityIcons name="alert-circle-outline" size={20} color={c.danger} /><Text style={s.errorText}>{message}</Text></View> : null;
});
interface BusinessChipsProps { items: { id: string; label: string }[]; selected: string; onSelect: (value: string) => void; label: string; disabled?: boolean }
export const BusinessChips = memo(function BusinessChips({ items, selected, onSelect, label, disabled }: BusinessChipsProps) {
  const { colors: c, styles: s } = useBusinessTheme();
  return <View style={s.chipBar}><FlatList horizontal data={items} keyExtractor={item => item.id} showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipContent} accessibilityLabel={label} renderItem={({ item }) => <Pressable disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: item.id === selected }} onPress={() => onSelect(item.id)} style={({ pressed }) => [s.chip, selected === item.id ? s.chipSelected : null, pressed ? s.pressed : null]}><Text style={[s.chipText, selected === item.id ? s.chipTextSelected : null]}>{item.label}</Text></Pressable>} /></View>;
});
