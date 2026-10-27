import React, { memo, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import { useUniversityMarquee } from '@/hooks/useUniversityMarquee';
import { universityColors as neon, universityLayout } from '@/constants/universityTheme';
import { fontSize, fontWeight, radius, spacing } from '@/constants/theme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
interface NeonTickerHeaderProps {
  title: string; leftIcon?: IconName; rightIcon?: IconName;
  leftAction?: React.ReactNode; rightAction?: React.ReactNode;
}
export const NeonTickerHeader = memo(function NeonTickerHeader({ title, leftIcon = 'crown-outline', rightIcon = 'school-outline', leftAction, rightAction }: NeonTickerHeaderProps) {
  return <View style={styles.header}>
    <LinearGradient colors={[neon.violet, neon.pink, neon.gold, neon.pink, neon.violet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.headerLine} />
    {leftAction ? <View style={styles.headerAction}>{leftAction}</View> : null}
    <View style={styles.titleFrame}>
      <MaterialCommunityIcons name={leftIcon} size={18} color={neon.gold} />
      <Text accessibilityRole="header" style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{title}</Text>
      <MaterialCommunityIcons name={rightIcon} size={18} color={neon.violet} />
    </View>
    {rightAction ? <View style={styles.headerAction}>{rightAction}</View> : null}
  </View>;
});
interface LightRailProps { bottom?: boolean }
const LightRail = memo(function LightRail({ bottom = false }: LightRailProps) {
  return <View style={[styles.lightRail, bottom ? styles.bottomRail : styles.topRail]}>
    <LinearGradient colors={[neon.violet, neon.pink, neon.gold, neon.cyan, neon.pink, neon.violet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFillObject} />
    <View style={styles.ledDots} />
  </View>;
});
export interface NeonTickerItem { id: string; text: string; signature?: string; selectable?: boolean }
interface TickerMessageProps { item: NeonTickerItem; index: number; onSelect?: (id: string) => void }
const TickerMessage = memo(function TickerMessage({ item, index, onSelect }: TickerMessageProps) {
  const color = [neon.pink, neon.cyan, neon.gold, neon.violet][index % 4];
  const body = <>
    <MaterialCommunityIcons name={index % 2 === 0 ? 'heart-outline' : 'star-outline'} size={20} color={color} />
    <Text style={[styles.messageText, { color, textShadowColor: color }]} numberOfLines={1}>{item.text.toLocaleUpperCase('tr-TR')}</Text>
    <Text style={styles.signatureText}>{item.signature ?? 'CADDEDEN'}</Text>
    <MaterialCommunityIcons name={item.selectable ? 'chevron-right' : 'star-outline'} size={18} color={neon.violet} />
  </>;
  return item.selectable && onSelect ? <Pressable accessibilityRole="button" accessibilityLabel={`${item.text}. İşletmeyi aç`} onPress={() => onSelect(item.id)} style={({ pressed }) => [styles.message, pressed ? styles.pressed : null]}>{body}</Pressable> : <View style={styles.message}>{body}</View>;
});
interface MessageCycleProps {
  items: NeonTickerItem[]; minWidth: number; onLayout?: ReturnType<typeof useUniversityMarquee>['measureCycle'];
  duplicate?: boolean; onSelect?: (id: string) => void;
}
const MessageCycle = memo(function MessageCycle({ items, minWidth, onLayout, duplicate = false, onSelect }: MessageCycleProps) {
  // Intrinsic-width measured track, not a scrolling list: both cycles must have identical geometry.
  return <View onLayout={onLayout} style={[styles.cycle, { minWidth }]} accessibilityElementsHidden={duplicate} importantForAccessibility={duplicate ? 'no-hide-descendants' : 'auto'}>
    {items.map((item, index) => <TickerMessage key={item.id} item={item} index={index} onSelect={onSelect} />)}
  </View>;
});
interface NeonTickerProps {
  title: string; items: NeonTickerItem[]; leftIcon?: IconName; rightIcon?: IconName;
  compact?: boolean; error?: string; onRetry?: () => void; onAction?: () => void;
  actionLabel?: string; actionIcon?: IconName; onSelect?: (id: string) => void;
}
export const NeonTicker = memo(function NeonTicker({ title, items, leftIcon, rightIcon, compact = false, error, onRetry, onAction, actionLabel, actionIcon = 'pencil-outline', onSelect }: NeonTickerProps) {
  const contentKey = useMemo(() => items.map(item => `${item.id}:${item.text}:${item.signature ?? ''}`).join('|'), [items]);
  const motion = useUniversityMarquee(contentKey);
  return <View style={[styles.banner, compact ? styles.compact : null]}>
    <NeonTickerHeader title={title} leftIcon={leftIcon} rightIcon={rightIcon}
      leftAction={<Pressable onPress={motion.toggle} disabled={motion.reduced} hitSlop={{ top: spacing.sm, bottom: spacing.sm }} accessibilityRole="button" accessibilityLabel={motion.reduced ? 'Hareket azaltma açık; bant duraklatıldı' : motion.paused ? `${title} bandını oynat` : `${title} bandını duraklat`} accessibilityState={{ disabled: motion.reduced }} style={({ pressed }) => [styles.headerIconButton, motion.reduced ? styles.disabled : null, pressed ? styles.pressed : null]}><MaterialCommunityIcons name={motion.paused && !motion.reduced ? 'play-outline' : 'pause'} size={18} color={neon.violet} /></Pressable>}
      rightAction={onAction ? <Pressable onPress={onAction} hitSlop={{ top: spacing.sm, bottom: spacing.sm }} accessibilityRole="button" accessibilityLabel={actionLabel} style={({ pressed }) => [styles.headerIconButton, styles.writeButton, pressed ? styles.pressed : null]}><MaterialCommunityIcons name={actionIcon} size={18} color={neon.pink} /></Pressable> : undefined}
    />
    <View style={styles.ticker}>
      <View onLayout={motion.measureViewport} style={styles.marquee}>
        {motion.reduced ? <FlatList horizontal data={items} keyExtractor={item => item.id} showsHorizontalScrollIndicator={false} style={styles.reducedList} contentContainerStyle={styles.accessibleMessages} renderItem={({ item, index }) => <TickerMessage item={item} index={index} onSelect={onSelect} />} /> : <Animated.View style={[styles.track, motion.trackStyle]}>
          <MessageCycle items={items} minWidth={motion.viewport} onLayout={motion.measureCycle} onSelect={onSelect} />
          <MessageCycle items={items} minWidth={motion.viewport} duplicate onSelect={onSelect} />
        </Animated.View>}
      </View>
      {error && onRetry ? <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Bandı yeniden yükle" style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}><MaterialCommunityIcons name="refresh" size={18} color={neon.cyan} /></Pressable> : null}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, motion.glowStyle]}><LightRail /><LightRail bottom /></Animated.View>
    </View>
  </View>;
});
const styles = StyleSheet.create({
  banner: { backgroundColor: neon.background, marginVertical: spacing.sm, overflow: 'hidden' }, compact: { marginTop: 0 },
  header: { height: universityLayout.headerHeight, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: neon.background },
  headerAction: { width: universityLayout.height, height: universityLayout.headerHeight, alignItems: 'center', justifyContent: 'center' },
  headerIconButton: { width: universityLayout.height, height: universityLayout.headerHeight, alignItems: 'center', justifyContent: 'center', backgroundColor: neon.surface },
  disabled: { opacity: 0.5 }, headerLine: { position: 'absolute', left: 0, right: 0, height: 2 },
  titleFrame: { height: universityLayout.headerHeight - spacing.xs, flexShrink: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, backgroundColor: neon.surfaceTint, borderWidth: 1, borderColor: neon.violet, borderRadius: radius.sm, shadowColor: neon.pink, shadowRadius: spacing.sm, shadowOpacity: 0.85, shadowOffset: { width: 0, height: 0 }, elevation: 3 },
  headerTitle: { flexShrink: 1, color: neon.gold, fontSize: fontSize.md, fontWeight: fontWeight.bold, includeFontPadding: false, letterSpacing: 1, textShadowColor: neon.pink, textShadowRadius: spacing.xs, textShadowOffset: { width: 0, height: 0 } },
  ticker: { height: universityLayout.height, flexDirection: 'row', alignItems: 'center', backgroundColor: neon.surface, borderLeftWidth: 2, borderLeftColor: neon.pink, borderRightWidth: 2, borderRightColor: neon.violet },
  lightRail: { position: 'absolute', left: 0, right: 0, height: universityLayout.railHeight, overflow: 'hidden' }, topRail: { top: 0 }, bottomRail: { bottom: 0 },
  ledDots: { ...StyleSheet.absoluteFillObject, borderTopWidth: 2, borderStyle: 'dotted', borderColor: neon.white },
  marquee: { flex: 1, minWidth: 1, height: universityLayout.height, overflow: 'hidden' },
  track: { position: 'absolute', left: 0, top: 0, height: universityLayout.height, flexDirection: 'row', alignItems: 'center' },
  cycle: { height: universityLayout.height, flexShrink: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  message: { minHeight: universityLayout.height, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginRight: spacing.lg, flexShrink: 0 },
  messageText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, includeFontPadding: false, textShadowRadius: spacing.xs, textShadowOffset: { width: 0, height: 0 } },
  signatureText: { color: neon.white, fontSize: fontSize.xs, fontWeight: fontWeight.bold, includeFontPadding: false, marginHorizontal: spacing.xs },
  iconButton: { width: universityLayout.height, height: universityLayout.height, alignItems: 'center', justifyContent: 'center', backgroundColor: neon.surface },
  writeButton: { backgroundColor: neon.surfaceTint, borderLeftWidth: 1, borderLeftColor: neon.violet },
  pressed: { opacity: 0.65, transform: [{ scale: 0.97 }] }, reducedList: { height: universityLayout.height },
  accessibleMessages: { paddingHorizontal: spacing.md, gap: spacing.xl, alignItems: 'center' },
});
