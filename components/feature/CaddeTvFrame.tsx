import React, { memo, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useCaddeTvTransition } from '@/hooks/useCaddeTvTransition';
import { caddeTvColors as c, caddeTvLayout as frame, caddeTvStage } from '@/constants/caddeTvTheme';
import { fontSize, fontWeight, spacing } from '@/constants/theme';

// Decorative interference texture, not a content list; no generated image or flashing loop.
const tuningBands = Array.from({ length: 24 }, (_, index) => ({
  id: `tuning-${index}`, light: 1 + (index * 7) % 9, dark: 1 + (index * 3) % 7,
}));

interface CaddeTvFrameProps {
  width: number; image?: string | null; onPress?: () => void; loading?: boolean;
  error?: string; emptyText?: string; preview?: boolean; reduced?: boolean;
  subtitle?: ReactNode;
}
export const CaddeTvFrame = memo(function CaddeTvFrame({ width, image, onPress, loading, error, emptyText = 'Bu kategoride henüz yayın yok.', preview = false, reduced = false, subtitle }: CaddeTvFrameProps) {
  const canvasWidth = Math.max(1, width);
  const scale = canvasWidth / frame.canvasWidth;
  const height = Math.max(1, scale * caddeTvStage.cabinetHeight);
  const screenWidth = Math.max(1, canvasWidth * frame.screen.width);
  const imageHeight = Math.max(1, frame.canvasHeight * frame.screen.height * scale);
  const subtitleHeight = Math.max(1, caddeTvStage.subtitleSourceHeight * scale);
  const corner = canvasWidth * frame.screenCorner;
  const screenPosition = {
    left: canvasWidth * frame.screen.left,
    top: (frame.canvasHeight * frame.screen.top - caddeTvStage.sourceCropTop) * scale,
    width: screenWidth, height: imageHeight + subtitleHeight, borderRadius: corner,
  };
  const printedPosition = {
    left: canvasWidth * frame.printedSubtitle.left,
    top: (frame.canvasHeight * frame.printedSubtitle.top - caddeTvStage.sourceCropTop) * scale,
    width: canvasWidth * frame.printedSubtitle.width,
    height: Math.max(1, frame.canvasHeight * frame.printedSubtitle.height * scale),
  };
  const transition = useCaddeTvTransition(image, reduced || preview);
  return <View style={[styles.canvas, { width: canvasWidth, height }]}>
    <Image source={require('@/assets/images/cadde-tv-neon-room.png')} style={{ position: 'absolute', left: 0, top: -caddeTvStage.sourceCropTop * scale, width: canvasWidth, height: frame.canvasHeight * scale }} contentFit="fill" accessibilityLabel="Retro ahşap Cadde TV kasası" />
    <View pointerEvents="none" style={[styles.printedMask, printedPosition]} />
    <View style={[styles.screenShell, screenPosition]}>
      <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? 'button' : 'image'} accessibilityLabel={onPress ? 'Cadde TV ekranı. Sonraki işletme görseline geç.' : 'İşletme görselinin TV ekranındaki ön izlemesi'} style={({ pressed }) => [styles.screen, { height: imageHeight }, pressed ? styles.pressed : null]}>
        {transition.layers.current ? <>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, transition.incomingStyle]}><Image key={transition.layers.current} source={{ uri: transition.layers.current }} style={StyleSheet.absoluteFillObject} contentFit="contain" cachePolicy="memory-disk" transition={0} onLoad={() => transition.markReady(transition.layers.current)} onError={() => transition.markReady(transition.layers.current)} accessibilityLabel="İşletmenin yayın görseli" /></Animated.View>
        </> : <View style={styles.empty}>
          {loading ? <ActivityIndicator color={c.amber} /> : <MaterialCommunityIcons name="television-classic" size={preview ? 24 : 36} color={c.amber} />}
          <Text style={[styles.emptyTitle, preview ? styles.previewText : null]}>{preview ? 'Görselini burada gör' : 'Cadde TV'}</Text>
          {!preview ? <Text style={styles.emptyText}>{error ? 'Yayınlar yüklenemedi. Yenile düğmesiyle tekrar dene.' : loading ? 'Yayınlar hazırlanıyor…' : emptyText}</Text> : null}
        </View>}
        {transition.layers.previous ? <>
          <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFillObject, styles.staticTexture, transition.staticStyle]}>
            {tuningBands.map((band, index) => <View key={band.id} style={[styles.staticBand, index % 2 ? styles.staticBandReverse : null]}>
              <View style={[styles.staticLight, { flex: band.light }]} />
              <View style={[styles.staticDark, { flex: band.dark }]} />
              <View style={styles.staticDim} />
            </View>)}
          </Animated.View>
          <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFillObject, styles.tuningFlash, transition.flashStyle]} />
        </> : null}
        <LinearGradient pointerEvents="none" colors={[c.glass, c.transparent, c.transparent]} locations={[0, 0.09, 1]} style={StyleSheet.absoluteFillObject} />
      </Pressable>
      <View style={[styles.subtitleSlot, { height: subtitleHeight }]}>
        {preview ? <Text numberOfLines={1} style={styles.previewText}>CADDE TV · EKRANA TAM UYUMLU</Text> : subtitle}
      </View>
      <View pointerEvents="none" style={[styles.glassEdge, { borderRadius: corner }]} />
    </View>
  </View>;
});
const styles = StyleSheet.create({
  canvas: { position: 'relative', overflow: 'hidden', backgroundColor: c.room },
  printedMask: { position: 'absolute', backgroundColor: c.screen },
  // One continuous clipped glass surface contains both the photo and the live subtitle.
  screenShell: { position: 'absolute', overflow: 'hidden', backgroundColor: c.screen },
  screen: { position: 'relative', width: '100%', overflow: 'hidden', backgroundColor: c.screen },
  subtitleSlot: { width: '100%', overflow: 'hidden', backgroundColor: c.screen, justifyContent: 'center' },
  staticTexture: { backgroundColor: c.screen },
  staticBand: { flex: 1, flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.staticDark },
  staticBandReverse: { flexDirection: 'row-reverse' },
  staticLight: { backgroundColor: c.staticLight }, staticDark: { backgroundColor: c.staticDark },
  staticDim: { flex: 3, backgroundColor: c.staticDim }, tuningFlash: { backgroundColor: c.white },
  glassEdge: { ...StyleSheet.absoluteFillObject, borderWidth: 2, borderColor: c.trim },
  pressed: { opacity: 0.88 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.md },
  emptyTitle: { color: c.amber, fontSize: fontSize.xl, fontWeight: fontWeight.bold, includeFontPadding: false },
  emptyText: { color: c.muted, fontSize: fontSize.md, textAlign: 'center', lineHeight: fontSize.md * 1.6 },
  previewText: { color: c.amber, fontSize: fontSize.xs, includeFontPadding: false, textAlign: 'center' },
});
