import { memo, useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CafeArrivalModel } from '@/hooks/useCafeArrival';
import type { NearbyCafe } from '@/services/cafePresenceService';
import { useBubbleViewport } from '@/hooks/useBubbleViewport';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { fontSize, fontWeight, radius, shadow, spacing, ThemeColors } from '@/constants/theme';
import { FeedbackButton, FeedbackError } from './FeedbackControls';
import { VenueProfileChoice } from './VenueProfileChoice';
interface CafeArrivalBubbleProps { arrival: CafeArrivalModel; hidden?: boolean }
export const CafeArrivalBubble = memo(function CafeArrivalBubble({ arrival: m, hidden = false }: CafeArrivalBubbleProps) {
 const { colors: c, styles: s } = useThemeStyles(createStyles); const viewport = useBubbleViewport();
 const renderCafe = useCallback(({ item }: { item: NearbyCafe }) => {
  const selected = m.cafe?.business_id === item.business_id;
  return <Pressable disabled={m.busy} accessibilityRole="radio" accessibilityLabel={`${item.business_name}, ${Math.round(item.distance_meters)} metre`} accessibilityState={{ checked: selected, disabled: m.busy }} onPress={() => m.selectCafe(item.business_id)} style={({ pressed }) => [s.venue, selected ? s.selected : null, pressed ? s.pressed : null]}>
   <MaterialCommunityIcons name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={c.primaryDark} />
   <Text style={s.venueName} numberOfLines={2}>{item.business_name}</Text>
   <Text style={s.distance}>{Math.round(item.distance_meters)} m</Text>
  </Pressable>;
 }, [m.cafe?.business_id, m.busy, m.selectCafe, c.primaryDark, s]);
 if (hidden || !m.cafe) return null;
 const height = Math.max(1, Math.min(viewport.availableHeight, spacing.xxxl * 6 + Math.min(3, m.cafes.length) * (spacing.xxxl + spacing.lg)));
 return <View pointerEvents="box-none" style={[s.overlay, { top: viewport.top }]}>
  <View style={[s.bubble, { height }]} accessibilityLiveRegion="polite">
   <FlatList data={m.cafes} keyExtractor={item => item.business_id} renderItem={renderCafe} style={s.list} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
    ListHeaderComponent={<View style={s.header}><MaterialCommunityIcons name="storefront-outline" size={24} color={c.primaryDark} /><Text style={s.title}>Bu mekânda mısınız?</Text><Pressable disabled={m.busy} accessibilityRole="button" accessibilityLabel="Yakın işletmeleri kapat" onPress={m.dismiss} style={({ pressed }) => [s.close, pressed ? s.pressed : null]}><MaterialCommunityIcons name="close" size={22} color={c.textSubtle} /></Pressable></View>}
    ListFooterComponent={<View style={s.footer}>
     <VenueProfileChoice compact value={m.visible} enabled={m.profileEnabled} busy={m.busy} onChange={m.choose} />
    </View>}
   />
   <View style={s.actionBar}>
    <FeedbackError message={m.error} />
    <FeedbackButton compact busy={m.busy} label="Evet, buradayım" icon="check-circle-outline" onPress={() => { void m.confirm(); }} />
    <FeedbackButton compact secondary disabled={m.busy} label="Şimdi değil" onPress={m.dismiss} />
   </View>
  </View>
 </View>;
});
const createStyles = (c: ThemeColors) => StyleSheet.create({
 overlay: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center', zIndex: 110 },
 bubble: { width: '100%', maxWidth: 480, backgroundColor: c.surface, borderColor: c.brand, borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden', ...shadow.lg },
 list: { flex: 1 }, content: { padding: spacing.md, gap: spacing.sm },
 header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
 title: { flex: 1, color: c.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, includeFontPadding: false },
 close: { width: spacing.xxxl, height: spacing.xxxl, alignItems: 'center', justifyContent: 'center' },
 venue: { minHeight: spacing.xxxl, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, backgroundColor: c.surfaceAlt },
 selected: { borderColor: c.primaryDark, backgroundColor: c.primarySoft },
 venueName: { flex: 1, color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold, includeFontPadding: false },
 distance: { color: c.primaryDark, fontSize: fontSize.sm, fontWeight: fontWeight.medium, includeFontPadding: false },
 footer: { gap: spacing.sm, paddingTop: spacing.sm },
 actionBar: { padding: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderTopColor: c.border },
 pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
