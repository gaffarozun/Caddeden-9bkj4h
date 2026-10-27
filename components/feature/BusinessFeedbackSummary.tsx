import React, { memo, useMemo } from 'react';
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { BusinessFeedback, feedbackTopicLabel } from '@/services/feedbackService';
import { createFeedbackStyles } from '@/constants/feedbackStyles';
import { ExperienceAccessCard } from './ExperienceAccessCard';

interface FeedbackHighlightsProps { data: BusinessFeedback }
export const FeedbackHighlights = memo(function FeedbackHighlights({ data }: FeedbackHighlightsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createFeedbackStyles(colors), [colors]);
  return <View style={styles.compactHighlights}>
    {data.positive ? <View style={styles.compactHighlight}><MaterialCommunityIcons name="star-outline" size={18} color={colors.primaryDark} /><Text style={styles.compactHighlightText}>En beğenilen: {feedbackTopicLabel(data.positive.topic)} · {data.positive.count} müşteri</Text></View> : null}
    {data.reported ? <View style={styles.compactHighlight}><MaterialCommunityIcons name="flag-outline" size={18} color={colors.textSubtle} /><Text style={styles.compactHighlightText}>En çok bildirilen: {feedbackTopicLabel(data.reported.topic)} · {data.reported.count} kişi. Doğrulanmış bulgu değildir.</Text></View> : null}
    {data.requested ? <View style={styles.compactHighlight}><MaterialCommunityIcons name="lightbulb-outline" size={18} color={colors.primaryDark} /><Text style={styles.compactHighlightText}>En çok talep edilen: {feedbackTopicLabel(data.requested.topic)} · {data.requested.count} destek</Text></View> : null}
    {!data.positive && !data.reported && !data.requested ? <Text style={styles.subtle}>Öne çıkanlar, aynı konuda en az 3 farklı müşterinin katkısıyla oluşur.</Text> : null}
  </View>;
});

interface BusinessFeedbackSummaryProps { businessId: string; isDemo?: boolean }
export const BusinessFeedbackSummary = memo(function BusinessFeedbackSummary({ businessId, isDemo = false }: BusinessFeedbackSummaryProps) {
  return <ExperienceAccessCard businessId={businessId} isDemo={isDemo} />;
});
