import React, { memo } from 'react';
import { FlatList, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import { useUniversityMarquee } from '@/hooks/useUniversityMarquee';
import { universityColors as neon } from '@/constants/universityTheme';
import { fontSize, fontWeight, spacing } from '@/constants/theme';

interface SubtitleItem { id: string; text: string }
interface SubtitleMessageProps { item: SubtitleItem; index: number }
const SubtitleMessage = memo(function SubtitleMessage({ item, index }: SubtitleMessageProps) {
  const color = [neon.pink, neon.cyan, neon.gold, neon.violet][index % 4];
  return <View style={styles.message}><Text style={[styles.text, { color, textShadowColor: color }]} numberOfLines={1}>{item.text.toLocaleUpperCase('tr-TR')}</Text><MaterialCommunityIcons name="star-four-points-outline" size={16} color={color} /></View>;
});
interface SubtitleCycleProps { items: SubtitleItem[]; minWidth: number; onLayout?: (event: LayoutChangeEvent) => void; duplicate?: boolean }
const SubtitleCycle = memo(function SubtitleCycle({ items, minWidth, onLayout, duplicate = false }: SubtitleCycleProps) {
  // Two identical intrinsic-width cycles are needed for a seamless marquee, not a feed/list.
  return <View onLayout={onLayout} style={[styles.cycle, { minWidth }]} accessibilityElementsHidden={duplicate} importantForAccessibility={duplicate ? 'no-hide-descendants' : 'auto'}>
    {items.map((item, index) => <SubtitleMessage key={item.id} item={item} index={index} />)}
  </View>;
});
interface CaddeTvSubtitleProps {
  items: SubtitleItem[]; motion: ReturnType<typeof useUniversityMarquee>;
}
export const CaddeTvSubtitle = memo(function CaddeTvSubtitle({ items, motion }: CaddeTvSubtitleProps) {
  const label = items.map(item => item.text).join(' · ');
  return <View style={styles.subtitle}>
    <Pressable disabled={motion.reduced} onPress={motion.toggle} onLayout={motion.measureViewport} hitSlop={{ top: spacing.md, bottom: spacing.md }} accessibilityRole={motion.reduced ? 'text' : 'button'} accessibilityState={{ disabled: motion.reduced, selected: motion.paused }} accessibilityLabel={motion.reduced ? label : `${label}. ${motion.paused ? 'Yazı akışını devam ettir' : 'Yazı akışını durdur'}`} style={({ pressed }) => [styles.marquee, pressed ? styles.pressed : null]}>
      {motion.reduced ? <FlatList horizontal data={items} keyExtractor={item => item.id} renderItem={({ item, index }) => <SubtitleMessage item={item} index={index} />} contentContainerStyle={styles.cycle} showsHorizontalScrollIndicator={false} /> : <Animated.View style={[styles.track, motion.trackStyle]}>
        <SubtitleCycle items={items} minWidth={motion.viewport} onLayout={motion.measureCycle} />
        <SubtitleCycle items={items} minWidth={motion.viewport} duplicate />
      </Animated.View>}
    </Pressable>
    {motion.paused && !motion.reduced ? <MaterialCommunityIcons name="pause" size={16} color={neon.gold} style={styles.pauseIcon} /> : null}
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, motion.glowStyle]}>
      <LinearGradient colors={[neon.pink, neon.cyan, neon.gold, neon.violet, neon.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.rail, styles.topRail]} />
      <LinearGradient colors={[neon.violet, neon.gold, neon.pink, neon.cyan]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.rail, styles.bottomRail]} />
      <View style={[styles.dots, styles.topRail]} /><View style={[styles.dots, styles.bottomRail]} />
    </Animated.View>
  </View>;
});
const styles = StyleSheet.create({
  subtitle: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: neon.surface },
  marquee: { flex: 1, minWidth: 1, height: '100%', overflow: 'hidden' },
  track: { position: 'absolute', top: 0, bottom: 0, left: 0, flexDirection: 'row', alignItems: 'center' },
  cycle: { flexShrink: 0, height: '100%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  message: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginRight: spacing.lg },
  text: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, includeFontPadding: false, textShadowRadius: spacing.sm, textShadowOffset: { width: 0, height: 0 } },
  pauseIcon: { marginHorizontal: spacing.xs }, rail: { position: 'absolute', left: 0, right: 0, height: 2 }, topRail: { top: 0 }, bottomRail: { bottom: 0 },
  dots: { position: 'absolute', left: 0, right: 0, height: 2, borderTopWidth: 1, borderStyle: 'dotted', borderColor: neon.white },
  pressed: { opacity: 0.72 },
});
