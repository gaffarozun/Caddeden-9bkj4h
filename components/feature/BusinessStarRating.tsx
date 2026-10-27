import React, { memo, useEffect, useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useBusinessRating } from '@/hooks/useBusinessRating';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
import { FeedbackButton, FeedbackError } from './FeedbackControls';
const values = Array.from({ length: 10 }, (_, index) => (index + 1) / 2);
const label = (value: number) => value.toFixed(1).replace('.', ',');
interface BusinessStarRatingProps { businessId: string; isDemo?: boolean; referenceStyle?: boolean; onRatingsChange?: (rating: number, count: number) => void }
export const BusinessStarRating = memo(function BusinessStarRating({ businessId, isDemo = false, referenceStyle = false, onRatingsChange }: BusinessStarRatingProps) {
  const { colors } = useTheme(); const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const m = useBusinessRating(businessId, !isDemo);
  const rating = m.state?.rating;
  const count = m.state?.count;
  useEffect(() => { if (rating !== undefined && count !== undefined) onRatingsChange?.(Number(rating), Number(count)); }, [rating, count, onRatingsChange]);
  if (isDemo) return null;
  return <View style={styles.card}>
    <View style={styles.row}><View style={styles.info}><Text style={styles.heading}>Müşteri puanı</Text><Text style={styles.subtle}>{count ?? 0} kullanıcı · Her kullanıcı bir oy</Text></View><MaterialCommunityIcons name="star-outline" size={24} color={colors.primaryDark} /><Text style={styles.score}>{label(Number(rating ?? 0))}<Text style={styles.subtle}> / 5</Text></Text></View>
    {m.loading && !m.state ? <ActivityIndicator color={colors.primaryDark} /> : null}
    {m.state?.canRate ? <>
      <View style={styles.row}><Text style={styles.heading}>{m.state.mine == null ? 'İşletmeyi puanla' : 'Puanını güncelle'}</Text><Text style={styles.value}>{m.selected ? `${label(m.selected)} / 5` : 'Puan seç'}</Text></View>
      <View style={styles.stars} accessibilityLabel={`${label(m.selected)} yıldız`}>{[1, 2, 3, 4, 5].map(star => <MaterialCommunityIcons key={star} name={m.selected >= star ? 'star' : m.selected >= star - 0.5 ? 'star-half-full' : 'star-outline'} size={28} color={m.selected >= star - 0.5 ? colors.primaryDark : colors.textSubtle} />)}</View>
      <FlatList data={values} numColumns={5} scrollEnabled={false} keyExtractor={value => String(value)} columnWrapperStyle={styles.optionsRow} contentContainerStyle={styles.options} renderItem={({ item }) => <Pressable disabled={m.busy} accessibilityRole="button" accessibilityLabel={`${label(item)} yıldız ver`} accessibilityState={{ selected: item === m.selected, disabled: m.busy }} onPress={() => m.choose(item)} style={({ pressed }) => [styles.option, item === m.selected ? styles.optionSelected : null, pressed ? styles.pressed : null]}><Text style={[styles.optionText, item === m.selected ? styles.optionTextSelected : null]}>{label(item)}</Text></Pressable>} />
      <Text style={styles.subtle}>Yarım yıldız seçebilirsiniz. Puanınız yönetici onayı beklemeden ortalamaya katılır; güncelleme ikinci oy oluşturmaz.</Text>
      <FeedbackButton label={m.state.mine == null ? 'Puanımı gönder' : 'Puanımı güncelle'} icon="star-outline" busy={m.busy} disabled={!m.selected || m.selected === Number(m.state.mine)} onPress={() => { void m.submit(); }} />
    </> : !m.signedIn ? <FeedbackButton secondary label="Puan vermek için giriş yap" icon="login" onPress={() => router.push('/auth')} /> : m.state ? <Text style={styles.subtle}>Puanlama yalnızca aktif müşteri hesaplarına açıktır. İşletme ve yönetici hesapları puan veremez.</Text> : null}
    <FeedbackError message={m.error} />
    {m.error && !m.loading ? <FeedbackButton secondary label="Puan bilgisini yeniden yükle" onPress={m.refresh} /> : null}
    {m.notice ? <Text style={styles.notice} accessibilityLiveRegion="polite">{m.notice}</Text> : null}
  </View>;
});
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: { padding: spacing.lg, gap: spacing.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  info: { flex: 1 },
  heading: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text, includeFontPadding: false },
  subtle: { fontSize: fontSize.sm, color: colors.textSubtle, lineHeight: fontSize.sm * 1.6 },
  score: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.primaryDark, includeFontPadding: false },
  value: { marginLeft: 'auto', fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primaryDark },
  stars: { flexDirection: 'row', gap: spacing.sm },
  options: { gap: spacing.sm },
  optionsRow: { gap: spacing.sm },
  option: { flex: 1, minHeight: spacing.xxxl, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
  optionSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primaryDark },
  optionText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  optionTextSelected: { color: colors.primaryDark },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  notice: { fontSize: fontSize.md, color: colors.text, lineHeight: fontSize.md * 1.6 },
});
