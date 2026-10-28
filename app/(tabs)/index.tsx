// Powered by OnSpace.AI
import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BusinessCard, MainCategoryTabs, SearchBar, SubCategoryBar } from '@/components';
import { useDiscoveryFeed } from '@/hooks/useDiscoveryFeed';
import { useTabScrollToTop } from '@/hooks/useTabScrollToTop';
import { useTheme } from '@/hooks/useTheme';
import { DiscoveryRatingSort, discoveryRatingSorts } from '@/services/discoveryRatingService';
import { FeedbackButton, FeedbackChips, FeedbackError } from '@/components/feature/FeedbackControls';
import { MenuSearchCard } from '@/components/feature/MenuSearchCard';
import { DiscoveryResultRow } from '@/services/discoveryResultsService';
import { CampaignBanner } from '@/components/feature/CampaignBanner';
import { NotificationBell } from '@/components/feature/NotificationBell';
import { RefreshButton } from '@/components/feature/RefreshButton';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';

export default function DiscoverScreen() {
  const listRef = useTabScrollToTop<DiscoveryResultRow>();
  const { colors } = useTheme();
  const { query, setQuery, main, sub, setSub, onlyOpen, setOnlyOpen, ratingSort, setRatingSort,
    businesses, results, menuSearch, searching, counts, activeMain, handleMain, locating, locationError, refreshing, error, refresh } = useDiscoveryFeed();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const renderResult = useCallback(({ item: row }: { item: DiscoveryResultRow }) => {
    switch (row.kind) {
      case 'business': return <BusinessCard business={row.business} />;
      case 'menu': return <MenuSearchCard item={row.item} />;
      case 'menuHeader': return <View style={styles.resultHeader}>
        <View style={styles.resultTitleRow}><MaterialCommunityIcons name="clipboard-text-outline" size={22} color={colors.primaryDark} /><Text style={styles.sectionTitle}>Menü & Fiyatlar</Text></View>
        <Text style={styles.searchContext} numberOfLines={2}>“{query.trim()}” için ürün ve hizmetler</Text>
        <View style={styles.resultTitleRow}><MaterialCommunityIcons name="sort-ascending" size={18} color={colors.primaryDark} /><Text style={styles.priceOrder}>Fiyat: düşükten yükseğe</Text></View>
      </View>;
      case 'menuStatus': return <View style={styles.menuStatus} accessibilityLiveRegion="polite">
        {menuSearch.loading ? <View style={styles.resultTitleRow}><ActivityIndicator color={colors.primary} /><Text style={styles.searchContext}>Menüler ve fiyat listeleri aranıyor…</Text></View> : null}
        {menuSearch.error ? <><FeedbackError message={menuSearch.error} /><FeedbackButton label="Ürün aramasını yeniden dene" secondary onPress={menuSearch.retry} /></> : null}
        {!menuSearch.loading && !menuSearch.error && menuSearch.total === 0 ? <Text style={styles.searchContext}>Bu kategoride eşleşen ürün veya hizmet bulunamadı. İşletme adıyla eşleşen sonuçlar varsa aşağıda gösterilir.</Text> : null}
        {menuSearch.moreError ? <FeedbackError message={menuSearch.moreError} /> : null}
        {!menuSearch.loading && menuSearch.hasMore ? <FeedbackButton label={menuSearch.moreError ? 'Daha fazla sonucu yeniden yükle' : `Daha fazla ürün göster · ${menuSearch.items.length}/${menuSearch.total}`} secondary busy={menuSearch.loadingMore} onPress={menuSearch.loadMore} /> : null}
      </View>;
      case 'businessHeader': return <View style={styles.resultHeader}>
        <Text style={styles.sectionTitle}>İşletmeler ve kategoriler</Text>
        <Text style={styles.count}>{businesses.length} işletme</Text>
        <FeedbackChips label="İşletme sıralaması" hideLabel compact items={discoveryRatingSorts} selected={ratingSort} onSelect={value => setRatingSort(value as DiscoveryRatingSort)} />
      </View>;
    }
  }, [styles, colors, query, menuSearch, businesses.length, ratingSort, setRatingSort]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <View style={styles.brandBlock}>
          <Text style={styles.brand}>Caddeden</Text>
        </View>
        <View style={styles.headerActions}><RefreshButton onPress={refresh} refreshing={refreshing} /><NotificationBell /></View>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchLabel}>İşletme, kategori veya ürün ara</Text>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Örn. döner, kafe, saç kesimi" label="İşletme, kategori veya menüdeki ürün ve hizmet adını ara" maxLength={200} />
      </View>

      <FlatList
        ref={listRef}
        data={results}
        keyExtractor={(item) => item.key}
        renderItem={renderResult}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View>
            {locating ? <View style={styles.resultTitleRow}><ActivityIndicator color={colors.primary} /><Text style={styles.searchContext}>Konum alınıyor…</Text></View> : null}
            {locationError ? <View style={styles.feedError}><FeedbackError message={locationError} /><FeedbackButton label="Konumu yeniden dene" secondary busy={locating} onPress={() => setRatingSort('nearest')} /></View> : null}
            {error ? <View style={styles.feedError}><FeedbackError message={error} /><FeedbackButton label="Yeniden dene" secondary busy={refreshing} onPress={refresh} /></View> : null}
            {!searching ? <View style={styles.bleed}>
              <CampaignBanner main={main} />
            </View> : null}
            {!searching ? <Text style={styles.pickTitle}>Ne keşfetmek istersin?</Text> : null}
            <View style={styles.bleed}>
              <MainCategoryTabs compact={searching} selected={main} onSelect={handleMain} counts={counts} />
            </View>

            <View style={styles.bleed}>
              <SubCategoryBar main={main} selected={sub} onSelect={setSub} />
            </View>

            <View style={styles.sectionHead}>
              <View>
                <Text style={styles.sectionTitle}>{activeMain?.label ?? 'İşletmeler'}</Text>
                <Text style={styles.count}>{searching ? menuSearch.loading ? 'Ürünler aranıyor…' : `${menuSearch.total} ürün / hizmet · ${businesses.length} işletme` : `${businesses.length} işletme · ${discoveryRatingSorts.find(item => item.id === ratingSort)?.label}`}</Text>
              </View>
              <Pressable
                onPress={() => setOnlyOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel="Sadece açık işletmeleri göster"
                accessibilityState={{ selected: onlyOpen }}
                style={({ pressed }) => [styles.openFilter, onlyOpen ? styles.openFilterActive : null, pressed ? styles.pressed : null]}
              >
                <MaterialCommunityIcons
                  name={onlyOpen ? 'door-open' : 'door-closed'}
                  size={15}
                  color={onlyOpen ? colors.onPrimary : colors.textSubtle}
                />
                <Text style={[styles.openFilterText, onlyOpen ? { color: colors.onPrimary } : null]}>Sadece Açık</Text>
              </Pressable>
            </View>
            {!searching ? <View style={styles.ratingSort}>
              <FeedbackChips label="İşletme sıralaması" hideLabel compact items={discoveryRatingSorts} selected={ratingSort} onSelect={value => setRatingSort(value as DiscoveryRatingSort)} />
              {ratingSort === 'highest' ? <Text style={styles.count}>Puanı olmayan işletmeler ve demo içerikler sonda gösterilir.</Text> : null}
            </View> : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="store-search-outline" size={48} color={colors.textFaint} />
            <Text style={styles.emptyText}>{refreshing ? 'İşletmeler yükleniyor…' : error ? 'İşletmeler yüklenemedi. Yeniden deneyin.' : 'Bu kategoride henüz işletme bulunamadı.'}</Text>
          </View>
        }
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.primarySoft,
    borderBottomWidth: 1,
    borderTopColor: colors.brand,
    borderBottomColor: colors.brand,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandBlock: { flex: 1, paddingRight: spacing.sm },
  feedError: { gap: spacing.sm, marginBottom: spacing.lg },
  brand: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.primaryDark, letterSpacing: -0.5 },
  searchWrap: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  searchLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSubtle, includeFontPadding: false },
  list: { flex: 1 },
  resultHeader: { gap: spacing.sm, paddingVertical: spacing.sm },
  resultTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchContext: { fontSize: fontSize.md, color: colors.textSubtle, lineHeight: fontSize.md * 1.6, flexShrink: 1, includeFontPadding: false },
  priceOrder: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.primaryDark, includeFontPadding: false },
  menuStatus: { gap: spacing.sm },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  bleed: { marginHorizontal: -spacing.lg },
  pickTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  count: { fontSize: fontSize.sm, color: colors.textSubtle },
  ratingSort: { marginBottom: spacing.lg, gap: spacing.sm },
  openFilter: {
    minHeight: spacing.xxxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.72 },
  openFilterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  openFilterText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textSubtle },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.md },
  emptyText: { fontSize: fontSize.md, color: colors.textSubtle },
});
