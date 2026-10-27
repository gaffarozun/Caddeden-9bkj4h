// Powered by OnSpace.AI
import React, { useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PostCard, ScreenHeader } from '@/components';
import { MainCategoryTabs } from '@/components/ui/MainCategoryTabs';
import { usePostsFeed } from '@/hooks/usePostsFeed';
import { useTabScrollToTop } from '@/hooks/useTabScrollToTop';
import type { Post } from '@/services/types';
import { FeedbackButton, FeedbackError } from '@/components/feature/FeedbackControls';
import { useTheme } from '@/hooks/useTheme';
import { fontSize, fontWeight, spacing, ThemeColors } from '@/constants/theme';

export default function PostsScreen() {
  const listRef = useTabScrollToTop<Post>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { posts, main, setMain, categoryLabel, error, refreshing, refresh } = usePostsFeed();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader title="Gönderiler" />
      <View style={styles.categories}><MainCategoryTabs compact selected={main} onSelect={setMain} /></View>
      <View style={styles.categorySummary}>
        <View style={styles.categoryText}><Text style={styles.categoryTitle}>{categoryLabel}</Text><Text style={styles.count}>{posts.length} gönderi</Text></View>
      </View>
      <FlatList
        ref={listRef}
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} />}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        ListHeaderComponent={error ? <View style={styles.error}><FeedbackError message={error} /><FeedbackButton label="Yeniden dene" secondary busy={refreshing} onPress={refresh} /></View> : null}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>{error ? 'Gönderiler yüklenemedi.' : refreshing ? 'Gönderiler yükleniyor…' : 'Bu kategoride henüz gönderi yok.'}</Text></View>}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    categories: { paddingBottom: spacing.md },
    categorySummary: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    categoryText: { flex: 1, gap: spacing.xs },
    categoryTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
    count: { fontSize: fontSize.sm, color: colors.textSubtle },
    empty: { paddingVertical: spacing.xxl, alignItems: 'center' },
    emptyText: { fontSize: fontSize.md, color: colors.textSubtle, textAlign: 'center', lineHeight: fontSize.md * 1.6 },
    error: { gap: spacing.sm, marginBottom: spacing.lg },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, width: '100%', maxWidth: 960, alignSelf: 'center' },
  });
