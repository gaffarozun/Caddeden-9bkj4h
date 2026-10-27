import { useCallback, useEffect, useRef, useState } from 'react';
import { cancelAnimation, Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { caddeTvStage } from '@/constants/caddeTvTheme';

export function useCaddeTvTransition(image: string | null | undefined, reduced: boolean) {
  const [layers, setLayers] = useState<{ current: string | null; previous: string | null }>({ current: image ?? null, previous: null });
  const lastImage = useRef<string | null>(image ?? null);
  const [readyImage, setReadyImage] = useState<string | null>(null);
  const [effectDone, setEffectDone] = useState(true);
  const progress = useSharedValue(1);
  const markReady = useCallback((uri: string | null) => {
    if (uri && lastImage.current === uri) setReadyImage(uri);
  }, []);
  useEffect(() => {
    const nextImage = image ?? null;
    const previous = lastImage.current;
    lastImage.current = nextImage;
    cancelAnimation(progress);
    if (!nextImage || !previous || previous === nextImage || reduced) {
      setLayers({ current: nextImage, previous: null }); setEffectDone(true); progress.value = 1;
      return;
    }
    setLayers({ current: nextImage, previous });
    setEffectDone(false);
    progress.value = 0;
    // The old photo is never rendered underneath tuning. Reveal only the new, loaded photo.
    progress.value = withTiming(1, { duration: caddeTvStage.transitionMs, easing: Easing.linear });
    const timer = setTimeout(() => {
      progress.value = 1;
      setEffectDone(true);
    }, caddeTvStage.transitionMs);
    return () => { clearTimeout(timer); cancelAnimation(progress); };
  }, [image, reduced, progress]);
  useEffect(() => {
    if (effectDone && layers.previous && readyImage === layers.current) {
      setLayers(value => ({ current: value.current, previous: null }));
    }
  }, [effectDone, layers.previous, layers.current, readyImage]);
  const tuning = Boolean(layers.previous);
  const ready = readyImage === layers.current;
  const incomingStyle = useAnimatedStyle(() => ({ opacity: !tuning || (progress.value >= 1 && ready) ? 1 : 0 }));
  const staticStyle = useAnimatedStyle(() => ({
    opacity: progress.value >= 1 && ready ? 0 : 1,
    transform: [{ translateX: interpolate(progress.value, [0, 0.16, 0.3, 0.42, 0.5, 1], [0, -6, 6, -4, 4, 0]) }, { scaleX: 1.06 }],
  }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.3, 0.42, 0.5, 0.62, 1], [0, 0, 0.8, 0.65, 0, 0]),
    transform: [{ scaleY: interpolate(progress.value, [0, 0.3, 0.42, 0.5, 1], [0.01, 0.01, 0.025, 0.01, 0.01]) }],
  }));
  return { layers, incomingStyle, staticStyle, flashStyle, markReady };
}
