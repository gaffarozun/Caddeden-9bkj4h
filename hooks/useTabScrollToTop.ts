import { useEffect, useRef } from 'react';
import type { FlatList } from 'react-native';
import { useNavigation } from 'expo-router';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

type TabRoutes = Record<string, object | undefined>;

// Subscribe to the containing Expo Router tab, not focus events: returning from
// a detail page must not reset the list or reload discovery/post content.
export function useTabScrollToTop<Item>() {
  const listRef = useRef<FlatList<Item> | null>(null);
  const navigation = useNavigation<BottomTabNavigationProp<TabRoutes>>();
  const frame = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      const animated = navigation.isFocused();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        listRef.current?.scrollToOffset({ offset: 0, animated });
      });
    });
    return () => {
      unsubscribe();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [navigation]);

  return listRef;
}
