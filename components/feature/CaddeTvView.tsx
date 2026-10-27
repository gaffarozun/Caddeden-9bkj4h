import React, { memo } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCaddeTv } from '@/hooks/useCaddeTv';
import { useCaddeTvStage } from '@/hooks/useCaddeTvStage';
import { caddeTvColors as c, caddeTvLayout as frame } from '@/constants/caddeTvTheme';
import { fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import { CaddeTvFrame } from './CaddeTvFrame';
import { CaddeTvSubtitle } from './CaddeTvSubtitle';

interface ChannelButtonProps { direction: 'previous' | 'next'; onPress: () => void; disabled: boolean }
const ChannelButton = memo(function ChannelButton({ direction, onPress, disabled }: ChannelButtonProps) {
  return <Pressable accessibilityRole="button" accessibilityLabel={direction === 'previous' ? 'Önceki işletme görseline dön' : 'Sonraki işletme görseline geç'} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.channelButton, disabled ? styles.disabled : null, pressed ? styles.pressed : null]}><MaterialCommunityIcons name={direction === 'previous' ? 'chevron-left' : 'chevron-right'} size={28} color={c.amber} /></Pressable>;
});
interface CaddeTvViewProps {}
export const CaddeTvView = memo(function CaddeTvView(_: CaddeTvViewProps) {
  const tv = useCaddeTv();
  const stage = useCaddeTvStage();
  return <SafeAreaView style={styles.root} edges={['top']}>
    <ScrollView style={styles.root} onLayout={stage.measure} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={[styles.scene, { width: stage.width, height: stage.height }]}>
        <Image source={require('@/assets/images/cadde-tv-neon-room.png')} style={stage.roomPosition} contentFit="fill" transition={200} accessibilityLabel="Neon ışıklar, plaklar, bitkiler ve büyük retro televizyonla renkli Cadde TV odası" />
        <View style={styles.heading}><View style={styles.liveDot} /><Text style={styles.title}>Cadde TV</Text><Text style={styles.onAir}>{tv.current?.sponsored ? 'SPONSORLU' : ''}</Text>
        </View>
        <View style={styles.categoryOuter}><FlatList horizontal data={tv.categories} keyExtractor={item => item.id} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories} renderItem={({ item }) => <Pressable onPress={() => tv.selectMain(item.id)} accessibilityRole="button" accessibilityState={{ selected: tv.main === item.id }} style={({ pressed }) => [styles.category, tv.main === item.id ? styles.categoryActive : null, pressed ? styles.pressed : null]}><Text style={[styles.categoryText, tv.main === item.id ? styles.categoryTextActive : null]}>{item.label}</Text></Pressable>} /></View>
        <View style={[styles.tv, { left: stage.tvLeft, top: stage.tvTop }]}><CaddeTvFrame width={stage.tvWidth} image={tv.current?.image} onPress={tv.total > 1 ? tv.next : undefined} loading={tv.loading} error={tv.error} reduced={tv.motion.reduced}
          subtitle={<CaddeTvSubtitle items={tv.subtitleItems} motion={tv.motion} />} /></View>
      </View>
    </ScrollView>
    <View pointerEvents="box-none" style={styles.bottomDock}>
      <Pressable onPress={tv.write} accessibilityRole="button" accessibilityLabel="Cadde TV altyazısına yazı gönder. Yazın yönetici onayından sonra yayınlanır." style={({ pressed }) => [styles.writeAction, pressed ? styles.pressed : null]}>
        <MaterialCommunityIcons name="pencil-outline" size={20} color={c.writeAccent} />
        <Text style={styles.writeLabel}>Yazını TV’ye gönder</Text>
        <MaterialCommunityIcons name="arrow-top-right" size={18} color={c.writeAccent} />
      </Pressable>
      {tv.current ? <View style={styles.channelInfo}>
        <ChannelButton direction="previous" onPress={tv.previous} disabled={tv.total < 2} />
        <Pressable onPress={tv.openBusiness} accessibilityRole="button" accessibilityLabel={`${tv.current.businessName} işletme profilini aç`} style={({ pressed }) => [styles.businessLink, pressed ? styles.pressed : null]}>
          <MaterialCommunityIcons name="storefront-outline" size={20} color={c.amber} />
          <View style={styles.businessCopy}><Text style={styles.businessName} numberOfLines={1}>{tv.current.businessName}</Text><Text style={styles.profileHint}>İşletme profilini aç</Text></View>
          <MaterialCommunityIcons name="arrow-top-right" size={18} color={c.amber} />
        </Pressable>
        <ChannelButton direction="next" onPress={tv.next} disabled={tv.total < 2} />
      </View> : null}
    </View>
  </SafeAreaView>;
});
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.room }, scrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' }, scene: { position: 'relative', overflow: 'hidden' },
  heading: { position: 'absolute', top: spacing.lg, left: spacing.lg, right: spacing.lg, minHeight: spacing.xxxl, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: c.glass },
  liveDot: { width: spacing.sm, height: spacing.sm, borderRadius: radius.pill, backgroundColor: c.live }, title: { color: c.amber, fontSize: fontSize.xl, fontWeight: fontWeight.bold, includeFontPadding: false }, onAir: { flex: 1, textAlign: 'right', color: c.white, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  categoryOuter: { position: 'absolute', top: spacing.xxxl + spacing.xxl, left: 0, right: 0, minHeight: spacing.xxxl }, categories: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: 'center' }, category: { height: spacing.xxxl, borderRadius: radius.pill, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.glass, borderWidth: 1, borderColor: c.trim }, categoryActive: { backgroundColor: c.amber, borderColor: c.amber }, categoryText: { color: c.white, fontSize: fontSize.sm, fontWeight: fontWeight.medium }, categoryTextActive: { color: c.room },
  tv: { position: 'absolute' },
  bottomDock: { position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg, alignItems: 'center', gap: spacing.sm },
  writeAction: { minHeight: spacing.xxxl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: c.profileGlass, borderWidth: 1, borderColor: c.writeAccent },
  writeLabel: { color: c.writeAccent, fontSize: fontSize.md, fontWeight: fontWeight.semibold, includeFontPadding: false, textShadowColor: c.textShadow, textShadowRadius: spacing.sm, textShadowOffset: { width: 0, height: 1 } },
  channelInfo: { width: '100%', maxWidth: frame.maxStageWidth, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  channelButton: { width: spacing.xxxl, height: spacing.xxxl, alignItems: 'center', justifyContent: 'center', backgroundColor: c.profileGlass, borderWidth: 1, borderColor: c.profileBorder, borderRadius: radius.pill },
  businessLink: { minHeight: spacing.xxxl, flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: c.profileGlass, borderWidth: 1, borderColor: c.profileBorder, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, businessCopy: { flex: 1, minWidth: 0 }, businessName: { color: c.white, fontSize: fontSize.md, fontWeight: fontWeight.semibold, textShadowColor: c.textShadow, textShadowRadius: spacing.sm, textShadowOffset: { width: 0, height: 1 } }, profileHint: { color: c.amber, fontSize: fontSize.xs, marginTop: spacing.xs, textShadowColor: c.textShadow, textShadowRadius: spacing.sm, textShadowOffset: { width: 0, height: 1 } },
  disabled: { opacity: 0.35 }, pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
});
