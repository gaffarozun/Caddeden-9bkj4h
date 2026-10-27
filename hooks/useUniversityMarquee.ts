import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, LayoutChangeEvent } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { universityMotion } from '@/constants/universityTheme';

// Translate a pair of identical, measured cycles: the reset is visually identical to the last frame.
export function useUniversityMarquee(contentKey: string) {
  const [viewport, setViewport] = useState(375);
  const [cycle, setCycle] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => { setFocused(true); return () => { setFocused(false); }; }, []));
  const offset = useSharedValue(0);
  const glow = useSharedValue(1);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduced(value); }).catch(() => undefined);
    const reduction = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => { active = false; reduction.remove(); subscription.remove(); };
  }, []);
  const running = !paused && !reduced && foreground && focused;
  useEffect(() => {
    cancelAnimation(offset);
    offset.value = 0;
  }, [contentKey, offset]);
  useEffect(() => {
    cancelAnimation(offset); cancelAnimation(glow);
    if (running && cycle > 0) {
      const duration = Math.max(1, cycle / universityMotion.pixelsPerSecond * 1000);
      const remaining = Math.max(1, (cycle + Math.min(0, offset.value)) / universityMotion.pixelsPerSecond * 1000);
      // Resume from the current position, then reset only at the identical duplicated boundary.
      offset.value = withSequence(
        withTiming(-cycle, { duration: remaining, easing: Easing.linear }),
        withRepeat(withSequence(withTiming(0, { duration: 0 }), withTiming(-cycle, { duration, easing: Easing.linear })), -1, false),
      );
      glow.value = withRepeat(withTiming(0.72, { duration: universityMotion.glowDuration, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else glow.value = 1;
    return () => { cancelAnimation(offset); cancelAnimation(glow); };
  }, [running, cycle, contentKey, offset, glow]);
  const trackStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const measureViewport = useCallback((event: LayoutChangeEvent) => setViewport(Math.max(1, event.nativeEvent.layout.width)), []);
  const measureCycle = useCallback((event: LayoutChangeEvent) => setCycle(Math.max(1, event.nativeEvent.layout.width)), []);
  const toggle = useCallback(() => setPaused(value => !value), []);
  return { viewport, trackStyle, glowStyle, measureViewport, measureCycle, paused, reduced, toggle };
}
