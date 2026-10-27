// Powered by OnSpace.AI
// Full viewer for SAVED content (reel / post / campaign). It shows the saved
// content ITSELF — image + caption + the business it belongs to — instead of
// redirecting to the business page. A secondary action opens the business only
// if the user chooses to.
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SavedMedia } from '@/services/types';
import { useTheme } from '@/hooks/useTheme';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';

export type ContentKind = 'reel' | 'post' | 'campaign';

const KIND_META: Record<ContentKind, { label: string; icon: string }> = {
  reel: { label: 'Cadde TV', icon: 'television-classic' },
  post: { label: 'Gönderi', icon: 'image-outline' },
  campaign: { label: 'Kampanya', icon: 'sale' },
};

interface ContentViewerProps {
  visible: boolean;
  media: SavedMedia | null;
  kind: ContentKind;
  onClose: () => void;
  onOpenBusiness?: (businessId: string) => void;
}

export function ContentViewer({ visible, media, kind, onClose, onOpenBusiness }: ContentViewerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [dims, setDims] = useState({ width: 375, height: 667 });

  useEffect(() => {
    const update = () => setDims(Dimensions.get('window'));
    update();
    const sub = Dimensions.addEventListener('change', update);
    return () => sub?.remove();
  }, []);

  const cardW = Math.max(1, Math.min(dims.width * 0.88, 380));
  const imgH = Math.max(1, Math.min(dims.height * 0.5, cardW * 1.2));
  const meta = KIND_META[kind];

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {visible && media ? (
          <Animated.View entering={ZoomIn.springify().damping(16).mass(0.7)} style={[styles.card, { width: cardW }]}>
            <View style={[styles.imageWrap, { height: imgH }]}>
              <Image source={{ uri: media.image }} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} />
              <View style={styles.kindBadge}>
                <MaterialCommunityIcons name={meta.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={13} color={colors.white} />
                <Text style={styles.kindText}>{meta.label}</Text>
              </View>
            </View>

            <View style={styles.info}>
              <View style={styles.bizRow}>
                <MaterialCommunityIcons name="storefront-outline" size={16} color={colors.textSubtle} />
                <Text style={styles.bizName} numberOfLines={1}>{media.businessName}</Text>
              </View>
              {media.caption ? <Text style={styles.caption}>{media.caption}</Text> : null}
              {onOpenBusiness ? (
                <Pressable style={styles.bizBtn} onPress={() => onOpenBusiness(media.businessId)}>
                  <MaterialCommunityIcons name="storefront-outline" size={16} color={colors.primary} />
                  <Text style={styles.bizBtnText}>İşletmeyi Gör</Text>
                  <MaterialCommunityIcons name="chevron-right" size={16} color={colors.primary} />
                </Pressable>
              ) : null}
            </View>
          </Animated.View>
        ) : null}

        <Pressable style={styles.closeBtn} hitSlop={10} onPress={onClose}>
          <MaterialCommunityIcons name="close" size={22} color={colors.white} />
        </Pressable>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
    card: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surface },
    imageWrap: { width: '100%', backgroundColor: colors.black },
    kindBadge: {
      position: 'absolute',
      top: spacing.sm,
      left: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    kindText: { color: colors.white, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
    info: { padding: spacing.md, gap: spacing.sm },
    bizRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    bizName: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
    caption: { fontSize: fontSize.sm, color: colors.text, lineHeight: fontSize.sm * 1.5 },
    bizBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: radius.pill,
      marginTop: spacing.xs,
    },
    bizBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.primary },
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
