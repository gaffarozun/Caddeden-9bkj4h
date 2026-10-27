import React, { useCallback, useMemo, useRef } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { FeedbackTab, useBusinessFeedback } from '@/hooks/useBusinessFeedback';
import { useAlert } from '@/template';
import { FeedbackComplaint, FeedbackReview, FeedbackSuggestion, feedbackStatusLabel, feedbackTopicLabel } from '@/services/feedbackService';
import { createFeedbackStyles } from '@/constants/feedbackStyles';
import { FeedbackButton, FeedbackChips, FeedbackError } from '@/components/feature/FeedbackControls';
import { FeedbackHighlights } from '@/components/feature/BusinessFeedbackSummary';
import { FeedbackForm } from '@/components/feature/FeedbackForm';
import { FeedbackCriteriaScores } from '@/components/feature/FeedbackCriteria';
import { FeedbackReply } from '@/components/feature/FeedbackReply';

const tabs = [{ id: 'review', label: 'Yorumlar ve puanlar' }, { id: 'suggestion', label: 'Öneriler' }, { id: 'complaint', label: 'Şikâyetlerim' }];
const sorts = [{ id: 'newest', label: 'En yeni' }, { id: 'highest', label: 'En yüksek puan' }, { id: 'lowest', label: 'En düşük puan' }];
type Item = FeedbackReview | FeedbackSuggestion | FeedbackComplaint;
const date = (value: string) => new Date(value).toLocaleString('tr-TR');

export default function FeedbackScreen() {
  const { id: routeId, compose } = useLocalSearchParams<{ id: string; compose?: string }>();
  const id = typeof routeId === 'string' ? routeId : '';
  const router = useRouter(); const { showAlert } = useAlert();
  const { colors } = useTheme(); const styles = useMemo(() => createFeedbackStyles(colors), [colors]);
  const m = useBusinessFeedback(id, true, compose === '1');
  const listRef = useRef<FlatList<Item>>(null);
  const items: Item[] = m.tab === 'review' ? m.data?.reviews ?? [] : m.tab === 'suggestion' ? m.data?.suggestions ?? [] : m.data?.complaints ?? [];
  const removeReview = useCallback(() => {
    const mine = m.data?.mine;
    if (!mine) return;
    showAlert('Değerlendirmeyi sil', 'Deneyim değerlendirmeniz ve yorumunuz görünmeyecek. İşletme profilindeki bağımsız yıldız puanınız değişmeyecek.', [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Sil', style: 'destructive', onPress: () => { void m.run('delete_review', { id: mine.id }); } }]);
  }, [m.data?.mine, m.run, showAlert]);
  const report = (type: string, itemId: string) => {
    m.report(type, itemId);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };
  const renderItem = ({ item }: { item: Item }) => {
    if (m.tab === 'review') {
      const review = item as FeedbackReview;
      return <View style={styles.card}><View style={styles.row}><Text style={styles.heading}>{Number(review.rating).toFixed(1)} / 5</Text><Text style={styles.subtle}>{review.criteria_ratings && Object.keys(review.criteria_ratings).length ? 'Özelliklerin ortalaması' : feedbackTopicLabel(review.topic)}</Text></View><FeedbackCriteriaScores scores={review.criteria_ratings} /><Text style={styles.subtle}>Müşteri · {date(review.created_at)}</Text>{review.updated_at !== review.created_at ? <Text style={styles.subtle}>Güncellendi: {date(review.updated_at)}</Text> : null}{review.comment ? <Text style={styles.text}>{review.comment}</Text> : <Text style={styles.subtle}>Yalnızca puan değerlendirmesi</Text>}<FeedbackReply id={review.id} kind="review" owner={!!m.data?.owner} reply={review.reply} replyStatus={review.reply_status} canReport={m.canCustomer} onReport={() => report('review_reply', review.id)} />{m.canCustomer ? <FeedbackButton secondary label="Yorumu bildir" icon="flag-outline" disabled={m.busy} onPress={() => report('review', review.id)} /> : null}</View>;
    }
    if (m.tab === 'suggestion') {
      const suggestion = item as FeedbackSuggestion;
      return <View style={styles.card}><Text style={styles.heading}>{feedbackTopicLabel(suggestion.topic)}</Text><Text style={styles.text}>{suggestion.description}</Text><Text style={styles.heading}>{suggestion.supports} farklı kullanıcı desteği</Text><Text style={styles.subtle}>{feedbackStatusLabel(suggestion.status)}</Text>{suggestion.moderation_reason ? <Text style={styles.subtle}>Gerekçe: {suggestion.moderation_reason}</Text> : null}{m.canCustomer && suggestion.status === 'published' ? <FeedbackButton secondary label={suggestion.supported ? 'Desteğimi geri çek' : 'Bu öneriyi destekle'} icon="thumb-up-outline" disabled={m.busy} onPress={() => { void m.run('support', { id: suggestion.id, active: !suggestion.supported }); }} /> : null}<FeedbackReply id={suggestion.id} kind="suggestion" owner={!!m.data?.owner} reply={suggestion.reply} replyStatus={suggestion.reply_status} canReport={m.canCustomer && suggestion.status === 'published'} onReport={() => report('suggestion_reply', suggestion.id)} />{m.canCustomer && suggestion.status === 'published' ? <FeedbackButton secondary label="Öneriyi bildir" icon="flag-outline" onPress={() => report('suggestion', suggestion.id)} /> : null}</View>;
    }
    const complaint = item as FeedbackComplaint;
    return <View style={styles.card}><Text style={styles.heading}>{feedbackTopicLabel(complaint.feedback_category)}</Text><Text style={styles.subtle}>{feedbackStatusLabel(complaint.status)} · {date(complaint.created_at)}</Text>{complaint.description ? <Text style={styles.text}>{complaint.description}</Text> : null}{complaint.resolution_note ? <View style={styles.reply}><Text style={styles.heading}>Yönetici sonucu</Text><Text style={styles.text}>{complaint.resolution_note}</Text></View> : null}</View>;
  };
  if (m.experienceLoading || !m.experienceEnabled) return <SafeAreaView style={styles.screen} edges={['bottom']}><View style={styles.content}><View style={styles.card}><Text style={styles.heading}>Müşteri deneyimleri şimdilik kapalı</Text><Text style={styles.text}>{m.experienceLoading ? 'Özellik durumu kontrol ediliyor.' : 'Yorum ve müşteri deneyimleri alanı yönetici onayından sonra açılacak. İşletmenin profilindeki basit yıldız puanlama açık kalır.'}</Text><FeedbackButton secondary label="İşletme profiline dön" icon="arrow-left" onPress={() => router.replace(`/business/${id}`)} /></View></View></SafeAreaView>;
  return <SafeAreaView style={styles.screen} edges={['bottom']}><KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <FlatList<Item> ref={listRef} style={styles.screen} data={items} keyExtractor={item => item.id} renderItem={renderItem} removeClippedSubviews={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={m.loading && !!m.data} onRefresh={m.refresh} tintColor={colors.primaryDark} />}
      ListHeaderComponent={<View style={styles.section}><View style={styles.compactHero}><View style={styles.compactRow}><View style={styles.compactInfo}><Text style={styles.compactTitle}>Müşteri deneyimleri</Text><Text style={styles.subtle}>{m.data?.ratings?.count ?? 0} değerlendirme · Yorumlar herkese açık</Text></View>{m.data ? <Text style={styles.compactRating}>{Number(m.data.ratings?.rating ?? 0).toFixed(1)} / 5</Text> : null}</View></View>{m.data ? <FeedbackHighlights data={m.data} /> : null}<FeedbackError message={m.error} />{m.notice ? <View style={styles.tint} accessibilityLiveRegion="polite"><Text style={styles.text}>{m.notice}</Text></View> : null}{m.loading && !m.data ? <ActivityIndicator color={colors.primaryDark} /> : null}
        <FeedbackChips label="Deneyim alanı" items={tabs} selected={m.tab} onSelect={value => m.setTab(value as FeedbackTab)} disabled={m.busy} />
        {m.tab === 'review' ? <FeedbackChips label="Yorum sıralaması" items={sorts} selected={m.sort} onSelect={m.setSort} disabled={m.busy} /> : null}
        {m.tab === 'review' && m.data?.mine ? <View style={styles.card}><Text style={styles.heading}>Değerlendirmeniz · {Number(m.data.mine.rating).toFixed(1)} / 5</Text><FeedbackCriteriaScores scores={m.data.mine.criteria_ratings} /><Text style={styles.subtle}>{feedbackStatusLabel(m.data.mine.status)}</Text>{m.data.mine.comment ? <Text style={styles.text}>{m.data.mine.comment}</Text> : null}{m.data.mine.moderation_reason ? <Text style={styles.subtle}>Gerekçe: {m.data.mine.moderation_reason}</Text> : null}<View style={styles.row}><FeedbackButton secondary label="Düzenle" onPress={() => m.setFormOpen(true)} disabled={m.busy} /><FeedbackButton secondary danger label="Değerlendirmemi sil" onPress={removeReview} disabled={m.busy} /></View></View> : null}
        {m.canCustomer && !m.formOpen ? <FeedbackButton label={m.tab === 'review' ? m.data?.mine ? 'Puan ve yorumumu düzenle' : 'Yorum yaz ve değerlendir' : m.tab === 'suggestion' ? 'İyileştirme öner' : 'İşletme şikâyeti gönder'} onPress={() => m.setFormOpen(true)} disabled={m.busy} icon="plus" /> : !m.signedIn ? <FeedbackButton label="İşlem yapmak için giriş yap" onPress={() => router.push('/auth')} icon="login" /> : !m.canCustomer ? <Text style={styles.subtle}>{m.data?.owner ? 'Yayımlanmış yorum ve önerilere işletme olarak cevap verebilirsiniz.' : 'Puan, şikâyet ve öneri işlemleri yalnızca müşteri hesaplarına açıktır.'}</Text> : null}
        {m.tab === 'review' ? <View style={styles.section}><Text style={styles.heading}>Yayımlanan yorumlar ve puanlar</Text><Text style={styles.subtle}>Müşteri yorumları ve işletme cevapları aşağıda herkese açık olarak gösterilir.</Text></View> : null}
        {m.tab === 'complaint' ? <Text style={styles.subtle}>Yalnızca bu işletme hakkındaki kendi şikâyetleriniz görünür. İçerik bildirimleri yönetici tarafından ayrıca incelenir.</Text> : null}
      </View>}
      ListEmptyComponent={!m.loading ? <View style={styles.card}><Text style={styles.text}>{m.tab === 'review' ? 'Henüz yayımlanmış yorum veya puan yok. Yorum yaz butonuyla ilk deneyimi paylaşabilirsiniz.' : m.tab === 'suggestion' ? 'Henüz öneri yok. İlk öneriyi gönderebilirsiniz.' : 'Bu işletme için şikâyet kaydınız yok.'}</Text></View> : null}
      ListFooterComponent={m.tab === 'review' ? <View style={styles.row}><FeedbackButton secondary label="Önceki yorumlar" disabled={m.offset === 0 || m.loading} onPress={() => m.setOffset(Math.max(0, m.offset - 20))} /><FeedbackButton secondary label="Sonraki yorumlar" disabled={items.length < 20 || m.loading} onPress={() => m.setOffset(m.offset + 20)} /></View> : null}
    />
    <FeedbackForm model={m} />
  </KeyboardAvoidingView></SafeAreaView>;
}
