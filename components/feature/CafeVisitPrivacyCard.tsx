import React, { memo } from 'react';
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCafePresence } from '@/hooks/useCafePresence';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { createCafeStyles } from '@/constants/cafeStyles';
import { FeedbackButton, FeedbackError } from './FeedbackControls';
import { VenueProfilePrivacySetting } from './VenueProfilePrivacySetting';
interface CafeVisitPrivacyCardProps { businessId?: string }
export const CafeVisitPrivacyCard = memo(function CafeVisitPrivacyCard({ businessId }: CafeVisitPrivacyCardProps) {
  const m = useCafePresence(); const { colors: c, styles: s } = useThemeStyles(createCafeStyles);
  if (!m.visit || (businessId && m.visit.business_id !== businessId)) return null;
  const visit = m.visit;
  return <View style={s.card}>
    <View style={s.row}><MaterialCommunityIcons name="storefront-outline" size={22} color={c.primaryDark} /><Text style={s.title}>{visit.business_name}</Text></View>
    {visit.social_enabled !== false ? <>
    <VenueProfilePrivacySetting compact />
    <FeedbackButton compact busy={m.busy} disabled={!visit.photo_visible && !m.profileEnabled} icon={visit.photo_visible ? 'eye-off-outline' : 'eye-outline'} label={visit.photo_visible ? 'Profilimi gizle' : 'Profilimi göster'} onPress={() => { void m.setVisible(!visit.photo_visible); }} />
    </> : null}
    <FeedbackButton compact secondary busy={m.busy} icon="crosshairs-gps" label="Konumu doğrula" onPress={() => { void m.join(visit.business_id, visit.photo_visible); }} />
    <FeedbackButton compact secondary busy={m.busy} icon="logout" label="Mekândan ayrıl" onPress={() => { void m.leave(); }} />
    <FeedbackError message={m.error} />
    
  </View>;
});
