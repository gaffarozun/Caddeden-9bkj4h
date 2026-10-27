import { memo, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useUniversityMarquee } from '@/hooks/useUniversityMarquee';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
interface CampaignHeaderProps {}
export const CampaignHeader = memo(function CampaignHeader(_: CampaignHeaderProps) {
 const { colors: c, styles: s } = useThemeStyles(createStyles);
 return <View style={s.headingRow}><MaterialCommunityIcons name="ticket-percent-outline" color={c.primaryDark} size={26} /><Text style={s.title}>Güncel kampanyalar</Text></View>;
});
interface CampaignTickerItem { id: string; text: string; selectable?: boolean }
interface CampaignMessageProps { item: CampaignTickerItem; onSelect: (id: string) => void }
const CampaignMessage = memo(function CampaignMessage({ item, onSelect }: CampaignMessageProps) {
 const { colors: c, styles: s } = useThemeStyles(createStyles);
 const body = <><MaterialCommunityIcons name="tag-outline" color={c.primaryDark} size={22} /><Text style={s.messageText} numberOfLines={1}>{item.text}</Text>{item.selectable ? <MaterialCommunityIcons name="chevron-right" color={c.primaryDark} size={22} /> : null}</>;
 return item.selectable ? <Pressable accessibilityRole="button" accessibilityLabel={`${item.text}. İşletmeyi aç`} onPress={() => onSelect(item.id)} style={({ pressed }) => [s.message, pressed ? s.pressed : null]}>{body}</Pressable> : <View style={s.message}>{body}</View>;
});
interface CampaignTickerProps { items: CampaignTickerItem[]; error?: string; onRetry: () => void; onSelect: (id: string) => void; onSubmit?: () => void }
export const CampaignTicker = memo(function CampaignTicker({ items, error, onRetry, onSelect, onSubmit }: CampaignTickerProps) {
 const { colors: c, styles: s } = useThemeStyles(createStyles);
 const key = useMemo(() => items.map(item => `${item.id}:${item.text}`).join('|'), [items]);
 const motion = useUniversityMarquee(key);
 return <View style={s.card}>
  <View style={s.header}><CampaignHeader />{onSubmit ? <Pressable accessibilityRole="button" accessibilityLabel="Kampanya ver" onPress={onSubmit} style={({ pressed }) => [s.action, pressed ? s.pressed : null]}><MaterialCommunityIcons name="plus" size={20} color={c.onPrimary} /><Text style={s.actionText}>Kampanya ver</Text></Pressable> : null}</View>
  <View style={s.rail}>
   <View style={s.viewport} onLayout={motion.measureViewport}>
    {motion.reduced ? <FlatList horizontal data={items} keyExtractor={item => item.id} renderItem={({ item }) => <CampaignMessage item={item} onSelect={onSelect} />} showsHorizontalScrollIndicator={false} contentContainerStyle={s.cycle} /> : <Animated.View style={[s.track, motion.trackStyle]}>
     <View onLayout={motion.measureCycle} style={[s.cycle, { minWidth: Math.max(1, motion.viewport) }]}>{items.map(item => <CampaignMessage key={item.id} item={item} onSelect={onSelect} />)}</View>
     <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.cycle, { minWidth: Math.max(1, motion.viewport) }]}>{items.map(item => <CampaignMessage key={item.id} item={item} onSelect={onSelect} />)}</View>
    </Animated.View>}
   </View>
   <Pressable disabled={motion.reduced} accessibilityRole="button" accessibilityLabel={motion.paused ? 'Kampanya bandını oynat' : 'Kampanya bandını duraklat'} onPress={motion.toggle} style={({ pressed }) => [s.control, pressed ? s.pressed : null]}><MaterialCommunityIcons name={motion.paused ? 'play-outline' : 'pause'} size={22} color={c.primaryDark} /></Pressable>
  </View>
  {error ? <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [s.retry, pressed ? s.pressed : null]}><MaterialCommunityIcons name="alert-circle-outline" color={c.danger} size={20} /><Text style={s.error}>Kampanyalar yüklenemedi · Yeniden dene</Text></Pressable> : null}
 </View>;
});
const createStyles = (c: ThemeColors) => StyleSheet.create({
 card: { backgroundColor: c.surface, borderColor: c.brand, borderWidth: 1, borderRadius: radius.lg, marginHorizontal: spacing.lg, marginVertical: spacing.sm, overflow: 'hidden' },
 header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm, padding: spacing.md, backgroundColor: c.primarySoft },
 headingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 }, title: { color: c.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, includeFontPadding: false },
 action: { minHeight: spacing.xxxl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, backgroundColor: c.primary, borderRadius: radius.md }, actionText: { color: c.onPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
 rail: { height: spacing.xxxl + spacing.lg, flexDirection: 'row', backgroundColor: c.surfaceAlt }, viewport: { flex: 1, minWidth: 1, overflow: 'hidden', height: spacing.xxxl + spacing.lg },
 track: { position: 'absolute', left: 0, top: 0, flexDirection: 'row', height: spacing.xxxl + spacing.lg }, cycle: { height: spacing.xxxl + spacing.lg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, flexShrink: 0 },
 message: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: spacing.xxxl, marginRight: spacing.xl, flexShrink: 0 }, messageText: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
 control: { width: spacing.xxxl, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primarySoft }, retry: { minHeight: spacing.xxxl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, error: { color: c.danger, fontSize: fontSize.sm, flex: 1 }, pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
});
