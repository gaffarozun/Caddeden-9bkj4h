import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontSize, fontWeight, spacing } from '@/constants/theme';
import { caddedenIntroColors as colors, caddedenIntroLayout as layout } from '@/constants/caddedenIntroTheme';
import { useCaddedenIntro } from '@/hooks/useCaddedenIntro';

interface CaddedenIntroProps {
  intro: ReturnType<typeof useCaddedenIntro>;
}

export const CaddedenIntro = memo(function CaddedenIntro({ intro }: CaddedenIntroProps) {
  const insets = useSafeAreaInsets();
  if (!intro.visible) return null;
  return (
    <Animated.View
      style={[styles.screen, intro.overlayStyle]}
      accessibilityViewIsModal
      accessibilityLabel="Caddeden açılıyor"
      accessibilityRole="text"
    >
      <Animated.View style={[StyleSheet.absoluteFillObject, intro.streetStyle]} pointerEvents="none">
        <Image
          source={require('@/assets/images/caddeden-intro-street.webp')}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={0}
          accessible={false}
        />
      </Animated.View>
      <LinearGradient
        colors={[colors.transparent, colors.softOverlay, colors.background]}
        locations={[0, 0.78, 1]}
        start={intro.landscape ? { x: 0.35, y: 0 } : { x: 0.5, y: 0.42 }}
        end={intro.landscape ? { x: 1, y: 0 } : { x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <View style={[
        styles.wordmarkArea,
        intro.landscape ? styles.landscapeArea : null,
        { paddingBottom: insets.bottom + spacing.xxl, paddingLeft: insets.left + spacing.xl, paddingRight: insets.right + spacing.xl, paddingTop: insets.top + spacing.lg },
      ]} pointerEvents="none">
        <Animated.View style={[styles.wordmark, intro.landscape ? styles.landscapeWordmark : null, intro.titleStyle]}>
          <View style={styles.brandLine} />
          <Text style={[styles.title, intro.landscape ? styles.compactTitle : null]} maxFontSizeMultiplier={1.25}>Caddeden</Text>
          <Text style={styles.subtitle}>Bir cadde, birçok keşif.</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.background, zIndex: 100, overflow: 'hidden' },
  wordmarkArea: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  landscapeArea: { alignItems: 'flex-end', justifyContent: 'center' },
  wordmark: { alignItems: 'center', width: '100%', maxWidth: layout.wordmarkMaxWidth, gap: spacing.sm },
  landscapeWordmark: { maxWidth: layout.landscapeWordmarkWidth },
  brandLine: { width: spacing.xxl, height: spacing.xs, borderRadius: spacing.xs, backgroundColor: colors.accent, marginBottom: spacing.sm },
  title: { fontSize: layout.titleSize, fontWeight: fontWeight.bold, color: colors.text, letterSpacing: -1.5, includeFontPadding: false },
  compactTitle: { fontSize: layout.compactTitleSize },
  subtitle: { fontSize: fontSize.md, lineHeight: fontSize.md * 1.6, fontWeight: fontWeight.medium, color: colors.textSubtle, textAlign: 'center', includeFontPadding: false },
});
