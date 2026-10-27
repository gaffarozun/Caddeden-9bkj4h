import React, { memo, useMemo } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useExperienceApproval } from '@/hooks/useExperienceApproval';
import { useAlert } from '@/template';
import { createFeedbackStyles } from '@/constants/feedbackStyles';
import { FeedbackButton, FeedbackError } from '@/components/feature/FeedbackControls';
interface ExperienceApprovalControlProps {}
export const ExperienceApprovalControl = memo(function ExperienceApprovalControl(_props: ExperienceApprovalControlProps) {
  const { colors } = useTheme(); const styles = useMemo(() => createFeedbackStyles(colors), [colors]);
  const m = useExperienceApproval(); const { showAlert } = useAlert();
  return <View style={styles.card}>
    <Text style={styles.heading}>Müşteri deneyimleri · {m.loading ? 'Kontrol ediliyor' : m.enabled ? 'Açık' : 'Kapalı'}</Text>
    <Text style={styles.text}>Yorum ve müşteri deneyimleri bölümü yalnızca onayınızla kullanıma açılır. Basit yıldız puanlama ve Keşfet puan sıralaması bu anahtardan bağımsızdır.</Text>
    <FeedbackButton label={m.enabled ? 'Müşteri deneyimlerini kapat' : 'Onayla ve kullanıma aç'} icon={m.enabled ? 'lock-outline' : 'check-circle-outline'} busy={m.busy} disabled={m.loading || !!m.error} onPress={() => showAlert(m.enabled ? 'Müşteri deneyimlerini kapat' : 'Müşteri deneyimlerini onayla', m.enabled ? 'Yorum ve deneyim kutucuğu kapatılacak. Mevcut kayıtlar korunur, bağımsız yıldız puanlama açık kalır.' : 'Yorum, öneri ve işletme cevabı ekranlarına erişim açılacak. Bağımsız yıldız puanları değişmez.', [{ text: 'Vazgeç', style: 'cancel' }, { text: m.enabled ? 'Kapat' : 'Onayla', onPress: () => { void m.setEnabled(!m.enabled); } }])} />
    <FeedbackError message={m.error} />
    {m.error ? <FeedbackButton secondary label="Özellik durumunu yeniden yükle" onPress={m.refresh} /> : null}
    {m.notice ? <Text style={styles.text} accessibilityLiveRegion="polite">{m.notice}</Text> : null}
  </View>;
});
