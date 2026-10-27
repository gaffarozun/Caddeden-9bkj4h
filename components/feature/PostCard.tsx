// Powered by OnSpace.AI
import React, { memo, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Post } from '@/services/types';
import { usePostActions } from '@/hooks/usePostActions';
import { useTheme } from '@/hooks/useTheme';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';

interface PostCardProps {
  post: Post;
}

export const PostCard = memo(function PostCard({ post }: PostCardProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isBusiness, saved, toggleSave, share, sharing } = usePostActions(post);

  return (
    <View style={styles.card}>
      <Pressable
        style={({ pressed }) => [styles.header, pressed ? styles.pressed : null]}
        accessibilityRole="button"
        accessibilityLabel={`${post.businessName} işletme profilini aç`}
        onPress={() => router.push(`/business/${post.businessId}`)}
      >
        <Avatar name={post.businessName} size={40} />
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {post.businessName}
            </Text>
          </View>
          <Text style={styles.time}>{post.timeAgo}</Text>
        </View>
      </Pressable>

      <Image source={{ uri: post.image }} style={styles.image} contentFit="cover" transition={200} />

      {!isBusiness ? (
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Gönderiyi paylaş" accessibilityState={{ disabled: sharing, busy: sharing }} disabled={sharing} onPress={() => { void share(); }} style={({ pressed }) => [styles.actionBtn, sharing ? styles.disabled : null, pressed ? styles.pressed : null]}>
            {sharing ? <ActivityIndicator color={colors.primary} /> : <MaterialCommunityIcons name="share-variant-outline" size={24} color={colors.text} />}
            <Text style={styles.actionText}>Paylaş</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Gönderiyi kayıttan çıkar' : 'Gönderiyi kaydet'}
            accessibilityState={{ selected: saved }}
            onPress={toggleSave}
            style={({ pressed }) => [styles.actionBtn, pressed ? styles.pressed : null]}
          >
            <MaterialCommunityIcons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={24}
              color={saved ? colors.primary : colors.text}
            />
            <Text style={styles.actionText}>{saved ? 'Kaydedildi' : 'Kaydet'}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.footer}>
        {post.campaign ? <Badge label={post.campaign} tone="primary" /> : null}
        <Text style={styles.caption}>{post.caption}</Text>
      </View>
    </View>
  );
});

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    name: { flexShrink: 1, fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
    time: { fontSize: fontSize.xs, color: colors.textFaint, marginTop: 2 },
    image: { width: '100%', aspectRatio: 1, backgroundColor: colors.surfaceTint },
    actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl, paddingHorizontal: spacing.md, paddingTop: spacing.md },
    actionBtn: { minHeight: spacing.xxxl, minWidth: spacing.xxxl, paddingHorizontal: spacing.sm, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
    actionText: { fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.medium },
    footer: { padding: spacing.md, gap: spacing.sm },
    caption: { fontSize: fontSize.md, color: colors.text, lineHeight: fontSize.md * 1.6 },
  });
