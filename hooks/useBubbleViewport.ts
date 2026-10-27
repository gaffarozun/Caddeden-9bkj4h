import { useEffect, useState } from 'react';
import { Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/constants/theme';

export function useBubbleViewport() {
  const [height, setHeight] = useState(667);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const update = () => {
      const next = Dimensions.get('window').height;
      setHeight(Number.isFinite(next) && next > 0 ? next : 667);
    };
    update();
    const subscription = Dimensions.addEventListener('change', update);
    return () => subscription.remove();
  }, []);
  return {
    top: insets.top + spacing.sm,
    availableHeight: Math.max(1, height - insets.top - insets.bottom - spacing.lg),
  };
}
