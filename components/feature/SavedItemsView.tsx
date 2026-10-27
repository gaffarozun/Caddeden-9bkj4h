import React, { memo, useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSavedItems } from '@/hooks/useSavedItems';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { SavedLibraryItem, savedCategories } from '@/services/savedItemsService';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
import { BusinessCard } from './BusinessCard';
import { ContentViewer } from './ContentViewer';
import { BusinessError, BusinessHeader } from './BusinessProfileControls';

interface SavedItemsViewProps {}
export const SavedItemsView = memo(function SavedItemsView(_props: SavedItemsViewProps) {
  const router = useRouter();
  const { colors, styles } = useThemeStyles(createStyles);
  const m = useSavedItems();
  const renderItem = useCallback(({ item }: { item: SavedLibraryItem }) => {
    if (item.kind === 'business') return <BusinessCard business={item.business} />;
    const label = item.kind === 'post' ? 'Gönderi' : item.kind === 'reel' ? 'Cadde TV' : 'Kampanya';
    const icon = item.kind === 'post' ? 'image-outline' : item.kind === 'reel' ? 'play-box-outline' : 'tag-outline';
    return <Pressable accessibilityRole="button" accessibilityLabel={`${item.media.businessName}, ${label}`} onPress={() => m.openViewer(item.media, item.kind)} style={({ pressed }) => [styles.mediaCard, pressed ? styles.pressed : null]}>
      {item.media.image ? <Image source={{ uri: item.media.image }} style={styles.image} contentFit="cover" transition={200} /> : <View style={[styles.image, styles.imageEmpty]}><MaterialCommunityIcons name={icon} size={28} color={colors.primary} /></View>}
      <View style={styles.info}><View style={styles.kind}><MaterialCommunityIcons name={icon} size={18} color={colors.primary} /><Text style={styles.kindText}>{label}</Text></View><Text style={styles.name} numberOfLines={2}>{item.media.businessName}</Text>{item.media.caption ? <Text style={styles.body} numberOfLines={2}>{item.media.caption}</Text> : null}</View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textSubtle} />
    </Pressable>;
  }, [m.openViewer, styles, colors]);

  return <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
    <BusinessHeader title="Tüm kayıtlarım" onBack={() => router.back()} />
    <FlatList<SavedLibraryItem>
      style={styles.screen}
      data={m.items}
      keyExtractor={item => item.key}
      renderItem={renderItem}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={Separator}
      refreshControl={<RefreshControl refreshing={m.loading} onRefresh={m.refresh} tintColor={colors.primary} />}
      ListHeaderComponent={<View style={styles.intro}>
        <View style={styles.overview}><View style={styles.bookmark}><MaterialCommunityIcons name="bookmark-multiple-outline" size={26} color={colors.primary} /></View><View style={styles.info}><Text style={styles.heading}>{m.total} kayıt</Text><Text style={styles.body}>Kaydettiğin işletmeler ve paylaşımlar</Text></View></View>
        <View style={styles.categoryBar}><FlatList horizontal data={savedCategories} keyExtractor={item => item.id} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryContent} renderItem={({ item }) => {
          const selected = m.category === item.id;
          return <Pressable accessibilityRole="button" accessibilityLabel={`${item.label}, ${m.counts[item.id]} kayıt`} accessibilityState={{ selected }} onPress={() => m.selectCategory(item.id)} style={({ pressed }) => [styles.chip, selected ? styles.chipSelected : null, pressed ? styles.pressed : null]}><Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{item.label} · {m.counts[item.id]}</Text></Pressable>;
        }} /></View>
        <Text style={styles.sectionTitle}>{savedCategories.find(item => item.id === m.category)?.label} · {m.counts[m.category]} kayıt</Text>
        <BusinessError message={m.error} />
        {m.loading && m.items.length === 0 ? <ActivityIndicator color={colors.primary} /> : null}
      </View>}
      ListEmptyComponent={!m.loading ? <View style={styles.empty}><MaterialCommunityIcons name="bookmark-outline" size={36} color={colors.textSubtle} /><Text style={styles.emptyText}>{m.category === 'all' ? 'Henüz kayıtlı içerik yok.' : 'Bu kategoride kayıtlı içerik yok.'}</Text></View> : null}
    />
    <ContentViewer visible={m.viewer !== null} media={m.viewer?.media ?? null} kind={m.viewer?.kind ?? 'post'} onClose={m.closeViewer} onOpenBusiness={m.openBusiness} />
  </SafeAreaView>;
});

const Separator = memo(function Separator() { return <View style={separatorStyles.space} />; });
const separatorStyles = StyleSheet.create({ space: { height: spacing.md } });
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  intro: { gap: spacing.lg, marginBottom: spacing.lg },
  overview: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.brand, borderRadius: radius.lg },
  bookmark: { height: spacing.xxxl, width: spacing.xxxl, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, minWidth: 0, gap: spacing.xs },
  heading: { fontSize: fontSize.xl, color: colors.text, fontWeight: fontWeight.bold, includeFontPadding: false },
  sectionTitle: { fontSize: fontSize.lg, color: colors.text, fontWeight: fontWeight.semibold, includeFontPadding: false },
  body: { fontSize: fontSize.md, lineHeight: fontSize.md * 1.6, color: colors.textSubtle, includeFontPadding: false },
  categoryBar: { minHeight: spacing.xxxl + spacing.lg, marginHorizontal: -spacing.lg, paddingVertical: spacing.sm },
  categoryContent: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  chip: { height: spacing.xxxl, borderRadius: radius.pill, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: colors.textSubtle, fontSize: fontSize.md, fontWeight: fontWeight.medium },
  chipTextSelected: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
  mediaCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  image: { width: spacing.xxxl * 2, height: spacing.xxxl * 2, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  imageEmpty: { alignItems: 'center', justifyContent: 'center' },
  kind: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  kindText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  name: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.semibold, includeFontPadding: false },
  empty: { padding: spacing.xl, gap: spacing.md, alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  emptyText: { color: colors.textSubtle, fontSize: fontSize.md, lineHeight: fontSize.md * 1.6, textAlign: 'center' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
});
