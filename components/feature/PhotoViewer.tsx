// Powered by OnSpace.AI
// Lightweight photo preview. The image pops out with a grow (zoom-in) effect in
// a centered card that does NOT cover the whole screen. Tap the backdrop or the
// close button to dismiss. Used for business gallery photos and menu item images.
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';

interface PhotoViewerProps {
  visible: boolean;
  uri: string | null;
  caption?: string;
  onClose: () => void;
}

export function PhotoViewer({ visible, uri, caption, onClose }: PhotoViewerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [dimensions, setDimensions] = useState({ width: 375, height: 667 });

  useEffect(() => {
    const update = () => setDimensions(Dimensions.get('window'));
    update();
    const sub = Dimensions.addEventListener('change', update);
    return () => sub?.remove();
  }, []);

  const cardSize = Math.max(1, Math.min(dimensions.width * 0.82, 360));

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {visible && uri ? (
          <Animated.View entering={ZoomIn.springify().damping(16).mass(0.7)} style={[styles.card, { width: cardSize }]}>
            <Pressable onPress={() => {}}>
              <Image
                source={{ uri }}
                style={{ width: cardSize, height: cardSize, backgroundColor: colors.surfaceTint }}
                contentFit="cover"
                transition={150}
              />
              {caption ? (
                <View style={styles.captionWrap}>
                  <Text style={styles.caption} numberOfLines={2}>{caption}</Text>
                </View>
              ) : null}
            </Pressable>
          </Animated.View>
        ) : null}
        <Pressable style={styles.closeBtn} hitSlop={10} onPress={onClose}>
          <MaterialCommunityIcons name="close" size={22} color={colors.white} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', alignItems: 'center', justifyContent: 'center' },
    card: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surface },
    captionWrap: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    caption: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.medium, textAlign: 'center' },
    closeBtn: {
      position: 'absolute',
      top: 48,
      right: spacing.lg,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
