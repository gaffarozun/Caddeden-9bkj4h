import React, { memo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Animated from 'react-native-reanimated';
import { useVideoPlayer, VideoView } from 'expo-video';
import { caddedenIntroColors as colors } from '@/constants/caddedenIntroTheme';
import { useCaddedenIntro } from '@/hooks/useCaddedenIntro';

interface CaddedenIntroProps {
  intro: ReturnType<typeof useCaddedenIntro>;
}

// Web açılışı: gece caddesi videosu (başlık ve slogan videonun içinde). Sessiz oynar; tarayıcı otomatik
// oynatmayı engellerse veya video yüklenemezse alttaki ilk kare görseli görünür, açılış süresi uzamaz.
function IntroVideo() {
  const player = useVideoPlayer(require('@/assets/video/caddeden-intro.mp4'), (p) => {
    p.muted = true;
    p.loop = false;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFillObject}
      contentFit="contain"
      nativeControls={false}
      allowsFullscreen={false}
      allowsPictureInPicture={false}
    />
  );
}

export const CaddedenIntro = memo(function CaddedenIntro({ intro }: CaddedenIntroProps) {
  if (!intro.visible || Platform.OS !== 'web') return null;
  return (
    <Animated.View
      style={[styles.screen, intro.overlayStyle]}
      accessibilityViewIsModal
      accessibilityLabel="Caddeden açılıyor"
      accessibilityRole="text"
    >
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Image
          source={require('@/assets/images/caddeden-intro-web-poster.jpg')}
          style={StyleSheet.absoluteFillObject}
          contentFit="contain"
          transition={0}
          accessible={false}
        />
        <IntroVideo />
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.background, zIndex: 100, overflow: 'hidden' },
});
