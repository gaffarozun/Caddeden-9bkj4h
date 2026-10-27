import React, { memo, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { FeedbackReview } from '@/services/feedbackService';
import { createFeedbackStyles } from '@/constants/feedbackStyles';

interface FeedbackCommentPreviewProps { review: FeedbackReview; onOpen: () => void }
export const FeedbackCommentPreview = memo(function FeedbackCommentPreview({ review, onOpen }: FeedbackCommentPreviewProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createFeedbackStyles(colors), [colors]);
  return <Pressable accessibilityRole="button" accessibilityLabel="Yorumun tamamını ve işletme cevabını görüntüle" onPress={onOpen} style={({ pressed }) => [styles.commentPreview, pressed ? styles.pressed : null]}>
    <View style={styles.compactRow}>
      <MaterialCommunityIcons name="account-outline" size={18} color={colors.textSubtle} />
      <Text style={styles.commentAuthor}>{review.author ?? 'Müşteri'}</Text>
      <MaterialCommunityIcons name="star-outline" size={16} color={colors.primaryDark} />
      <Text style={styles.commentActionText}>{Number(review.rating).toFixed(1)} / 5</Text>
    </View>
    <Text style={styles.text} numberOfLines={3}>{review.comment}</Text>
    <Text style={styles.subtle}>{new Date(review.created_at).toLocaleDateString('tr-TR')}</Text>
    {review.reply ? <View style={styles.reply}><Text style={styles.commentAuthor}>İşletmenin cevabı</Text><Text style={styles.text} numberOfLines={2}>{review.reply}</Text></View> : null}
  </Pressable>;
});
