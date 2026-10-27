import React, { memo } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useOrderRatings } from '@/hooks/useOrderRatings';
import { useBubbleViewport } from '@/hooks/useBubbleViewport';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { fontSize, fontWeight, radius, shadow, spacing, ThemeColors } from '@/constants/theme';
import { FeedbackError } from './FeedbackControls';

const scores = Array.from({ length: 10 }, (_, index) => (index + 1) / 2);
const scoreLabel = (value: number) => value.toFixed(1).replace('.', ',');
interface OrderRatingBubbleProps { hidden?: boolean }

export const OrderRatingBubble = memo(function OrderRatingBubble({ hidden = false }: OrderRatingBubbleProps) {
  const m = useOrderRatings();
  const { colors: c, styles: s } = useThemeStyles(createStyles);
  const viewport = useBubbleViewport();
  if (hidden || (!m.current && !m.notice)) return null;

  if (m.notice) return <View pointerEvents="box-none" style={[s.overlay, { top: viewport.top }]}>
    <View style={s.success} accessibilityLiveRegion="polite">
      <View style={s.successHead}><View style={s.successIcon}><MaterialCommunityIcons name="check-circle-outline" size={28} color={c.success} /></View><Text style={s.title}>Değerlendirmen gönderildi</Text></View>
      <Text style={s.copy} numberOfLines={3}>{m.notice}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Değerlendirme onayını kapat" onPress={m.closeNotice} style={({ pressed }) => [s.submit, pressed ? s.pressed : null]}><Text style={s.submitText}>Tamam</Text></Pressable>
    </View>
  </View>;

  const prompt = m.current;
  if (!prompt) return null;
  return <View pointerEvents="box-none" style={[s.overlay, { top: viewport.top }]}>
    <View style={[s.bubble, { height: Math.min(viewport.availableHeight, spacing.xxxl * 9 + spacing.md * 2) }]} accessibilityLiveRegion="polite">
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        <View style={s.header}>
          <View style={s.headerCopy}><Text style={s.eyebrow}>TESLİM EDİLEN SİPARİŞ</Text><Text style={s.business} numberOfLines={1}>{prompt.business_name}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Değerlendirmeyi sonraki açılışa ertele" accessibilityState={{ disabled: m.busy }} disabled={m.busy} onPress={m.postpone} style={({ pressed }) => [s.close, m.busy ? s.disabled : null, pressed ? s.pressed : null]}><MaterialCommunityIcons name="close" size={22} color={c.textSubtle} /></Pressable>
        </View>
        <View><Text style={s.title}>İşletmeyi değerlendir</Text><Text style={s.hint}>#{prompt.order_id.slice(0, 8)} · Puanını buradan gönderebilirsin</Text></View>
        <View style={s.scoreHead}><Text style={s.label}>İşletme puanın</Text><View style={s.scoreValue}><MaterialCommunityIcons name={m.selected ? 'star' : 'star-outline'} size={20} color={c.primaryDark} /><Text style={s.selected}>{m.selected ? `${scoreLabel(m.selected)} / 5` : 'Puan seç'}</Text></View></View>
        <FlatList
          style={s.scoreGrid}
          data={scores}
          numColumns={5}
          scrollEnabled={false}
          keyExtractor={item => String(item)}
          contentContainerStyle={s.scores}
          columnWrapperStyle={s.scoreRow}
          renderItem={({ item }) => <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${scoreLabel(item)} yıldız`}
            accessibilityState={{ selected: m.selected === item, disabled: m.busy }}
            disabled={m.busy}
            onPress={() => m.choose(item)}
            style={({ pressed }) => [s.option, m.selected === item ? s.optionSelected : null, m.busy ? s.disabled : null, pressed ? s.pressed : null]}
          ><Text style={[s.optionText, m.selected === item ? s.optionTextSelected : null]}>{scoreLabel(item)}</Text></Pressable>}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="İşletme puanımı doğrudan gönder" accessibilityState={{ disabled: m.busy || !m.selected }} disabled={m.busy || !m.selected} onPress={() => { void m.submit(); }} style={({ pressed }) => [s.submit, m.busy || !m.selected ? s.disabled : null, pressed ? s.pressed : null]}>
          {m.busy ? <ActivityIndicator color={c.onPrimary} /> : <MaterialCommunityIcons name="send-outline" size={20} color={c.onPrimary} />}
          <Text style={s.submitText}>{m.busy ? 'Gönderiliyor…' : 'Puanımı gönder'}</Text>
        </Pressable>
        <FeedbackError message={m.error} />
        <Pressable accessibilityRole="button" accessibilityLabel="Değerlendirmeyi daha sonra yap" accessibilityState={{ disabled: m.busy }} disabled={m.busy} onPress={m.postpone} style={({ pressed }) => [s.later, m.busy ? s.disabled : null, pressed ? s.pressed : null]}><Text style={s.laterText}>Daha sonra</Text></Pressable>
      </ScrollView>
      <View pointerEvents="none" style={s.tail} />
    </View>
  </View>;
});

const createStyles = (c: ThemeColors) => StyleSheet.create({
  overlay: { position: 'absolute', left: spacing.lg, right: spacing.lg, zIndex: 101, alignItems: 'center' },
  bubble: { width: '100%', maxWidth: 600, backgroundColor: c.surface, borderWidth: 1, borderColor: c.brand, borderRadius: radius.xxl, ...shadow.lg },
  scroll: { flex: 1, borderRadius: radius.xxl },
  content: { padding: spacing.md, gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerCopy: { flex: 1, gap: spacing.xs },
  eyebrow: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: c.primaryDark, includeFontPadding: false },
  business: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text, includeFontPadding: false },
  close: { width: spacing.xxxl, height: spacing.xxxl, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primarySoft, borderRadius: radius.lg },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text, lineHeight: fontSize.md * 1.6, includeFontPadding: false, flexShrink: 1 },
  hint: { fontSize: fontSize.xs, color: c.textSubtle, lineHeight: fontSize.xs * 1.6, includeFontPadding: false },
  scoreHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  label: { color: c.textSubtle, fontSize: fontSize.sm, fontWeight: fontWeight.medium, includeFontPadding: false },
  scoreValue: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  selected: { color: c.primaryDark, fontSize: fontSize.md, fontWeight: fontWeight.bold, includeFontPadding: false },
  scoreGrid: { flexGrow: 0 },
  scores: { gap: spacing.sm },
  scoreRow: { gap: spacing.xs },
  option: { flex: 1, minHeight: spacing.xxxl, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt, borderColor: c.borderStrong, borderWidth: 1, borderRadius: radius.md },
  optionSelected: { backgroundColor: c.primary, borderColor: c.primary },
  optionText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text, includeFontPadding: false },
  optionTextSelected: { color: c.onPrimary },
  submit: { minHeight: spacing.xxxl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: c.primary, borderRadius: radius.lg },
  submitText: { color: c.onPrimary, fontSize: fontSize.md, fontWeight: fontWeight.semibold, includeFontPadding: false },
  later: { minHeight: spacing.xxxl, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg },
  laterText: { color: c.textSubtle, fontSize: fontSize.md, fontWeight: fontWeight.medium, includeFontPadding: false },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  tail: { position: 'absolute', bottom: -spacing.xs, right: spacing.xxl, width: spacing.sm, height: spacing.sm, backgroundColor: c.surface, borderBottomWidth: 1, borderRightWidth: 1, borderColor: c.brand, transform: [{ rotate: '45deg' }] },
  success: { width: '100%', maxWidth: 600, backgroundColor: c.surface, borderWidth: 1, borderColor: c.success, borderRadius: radius.xxl, padding: spacing.lg, gap: spacing.md, ...shadow.lg },
  successHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  successIcon: { width: spacing.xxxl, height: spacing.xxxl, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: c.successSoft },
  copy: { fontSize: fontSize.md, color: c.text, lineHeight: fontSize.md * 1.6, includeFontPadding: false },
});
