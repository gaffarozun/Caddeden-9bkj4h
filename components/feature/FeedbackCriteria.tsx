import React, { memo, useMemo } from 'react';
import { FlatList, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { CriteriaRatings, FeedbackTopic, feedbackTopics } from '@/services/feedbackService';
import { createFeedbackStyles } from '@/constants/feedbackStyles';
import { FeedbackStars } from './FeedbackControls';

interface FeedbackCriteriaInputProps {
  scores: CriteriaRatings;
  selected: number;
  average: number;
  disabled?: boolean;
  onChange: (topic: FeedbackTopic, stars: number) => void;
}
export const FeedbackCriteriaInput = memo(function FeedbackCriteriaInput({ scores, selected, average, disabled, onChange }: FeedbackCriteriaInputProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createFeedbackStyles(colors), [colors]);
  return <View style={styles.section}>
    <Text style={styles.heading}>Değerlendirdiğiniz özellikler</Text>
    <Text style={styles.subtle}>Her özellik için ayrı yıldız seçin; tamamını tek seferde gönderin.</Text>
    {feedbackTopics.map(feature => <FeedbackStars key={feature.id} label={feature.label} rating={scores[feature.id] ?? 0} onChange={stars => onChange(feature.id, stars)} disabled={disabled} />)}
    <View style={styles.compactHero} accessibilityLiveRegion="polite">
      <Text style={styles.text}>{selected} / {feedbackTopics.length} özellik değerlendirildi</Text>
      {selected > 0 ? <Text style={styles.subtle}>{selected === feedbackTopics.length ? 'Genel puan' : 'Seçilen özelliklerin ortalaması'}: {average.toFixed(1)} / 5</Text> : null}
    </View>
  </View>;
});

interface FeedbackCriteriaScoresProps { scores?: CriteriaRatings }
export const FeedbackCriteriaScores = memo(function FeedbackCriteriaScores({ scores }: FeedbackCriteriaScoresProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createFeedbackStyles(colors), [colors]);
  const entries = useMemo(() => feedbackTopics.filter(feature => (scores?.[feature.id] ?? 0) > 0), [scores]);
  if (!entries.length) return null;
  return <View style={styles.criteriaRail}><FlatList horizontal data={entries} showsHorizontalScrollIndicator={false} keyExtractor={feature => feature.id} contentContainerStyle={styles.chipRow} renderItem={({ item }) => <View style={styles.criteriaPill} accessibilityLabel={`${item.label}: ${scores?.[item.id]} / 5 yıldız`}><Text style={styles.criteriaPillText}>{item.label}</Text><MaterialCommunityIcons name="star-outline" size={14} color={colors.primaryDark} /><Text style={styles.criteriaPillText}>{scores?.[item.id]}</Text></View>} /></View>;
});
