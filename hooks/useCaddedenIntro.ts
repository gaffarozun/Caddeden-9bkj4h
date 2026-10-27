import { useEffect, useState } from 'react';
import { AccessibilityInfo, Dimensions } from 'react-native';
import { cancelAnimation, Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { caddedenIntroMotion as motion } from '@/constants/caddedenIntroTheme';

// Mounted in the root navigator, so tab switches, login and background/resume do not replay it.
// Session/auth restoration runs underneath; neither assets nor network requests extend the intro.
export function useCaddedenIntro() {
  const [visible, setVisible] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 375, height: 667 });
  const opacity = useSharedValue(1);
  const street = useSharedValue(0);
  const title = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    const update = () => {
      const next = Dimensions.get('window');
      setDimensions({ width: Math.max(1, next.width || 375), height: Math.max(1, next.height || 667) });
    };
    update();
    const subscription = Dimensions.addEventListener('change', update);
    return () => subscription.remove();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    let exiting = false;
    let reduced = false;
    const startedAt = Date.now();
    const stopMotion = () => {
      cancelAnimation(street);
      cancelAnimation(title);
      title.value = 1;
    };
    const animate = (reduce: boolean) => {
      if (!active || exiting) return;
      reduced = reduce;
      if (reduce) { stopMotion(); return; }
      const remaining = Math.max(1, motion.totalMs - motion.exitMs - (Date.now() - startedAt));
      street.value = withTiming(1, { duration: Math.min(motion.streetMs, remaining), easing: Easing.linear });
      title.value = withDelay(motion.titleDelayMs, withTiming(1, { duration: motion.titleMs, easing: Easing.out(Easing.cubic) }));
    };
    // Fixed entrance duration: network and image decoding never extend the night-street animation.
    const exitTimer = setTimeout(() => {
      if (!active) return;
      exiting = true;
      if (!reduced) opacity.value = withTiming(0, { duration: motion.exitMs, easing: Easing.out(Easing.quad) });
    }, motion.totalMs - motion.exitMs);
    const endTimer = setTimeout(() => { if (active) setVisible(false); }, motion.totalMs);
    void AccessibilityInfo.isReduceMotionEnabled().then(animate).catch(() => animate(false));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (reduce) => {
      if (!active) return;
      reduced = reduce;
      if (reduce) {
        stopMotion();
        cancelAnimation(opacity);
        opacity.value = 1;
      }
    });
    return () => {
      active = false;
      clearTimeout(exitTimer);
      clearTimeout(endTimer);
      subscription.remove();
      cancelAnimation(opacity);
      cancelAnimation(street);
      cancelAnimation(title);
    };
  }, [visible, opacity, street, title]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const streetStyle = useAnimatedStyle(() => ({ transform: [
    { scale: interpolate(street.value, [0, 1], [motion.streetStartScale, motion.streetEndScale]) },
    { translateY: interpolate(street.value, [0, 1], [0, -motion.streetTravel]) },
  ] }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: title.value,
    transform: [{ translateY: interpolate(title.value, [0, 1], [motion.titleTravel, 0]) }],
  }));
  return { visible, landscape: dimensions.width > dimensions.height, overlayStyle, streetStyle, titleStyle };
}
