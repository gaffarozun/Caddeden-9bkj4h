import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCafeAccountPanel } from '@/hooks/useCafeAccountPanel';
import { useCafePresence } from '@/hooks/useCafePresence';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { createCafeStyles } from '@/constants/cafeStyles';
import { CafeArrivalStatusCard } from './CafeArrivalStatusCard';
import { CafeParticipationCard } from './CafeParticipationCard';
import { CafeSocialRequestsCard } from './CafeSocialRequestsCard';
import { VenueProfilePrivacySetting } from './VenueProfilePrivacySetting';
interface CafeAccountPanelProps {}
export const CafeAccountPanel = memo(function CafeAccountPanel({}: CafeAccountPanelProps) {
  const m = useCafeAccountPanel(); const presence = useCafePresence(); const { colors: c, styles: s } = useThemeStyles(createCafeStyles);
  if (!m.customer) return null;
  return <View style={s.accountSection}>
    <Pressable accessibilityRole="button" accessibilityLabel="Mekândakiler, profiller ve istekler" accessibilityState={{ expanded: m.expanded }} onPress={m.toggle} style={({ pressed }) => [s.venueButton, m.expanded ? s.venueButtonOpen : null, pressed ? s.pressed : null]}>
      <MaterialCommunityIcons name="account-group-outline" size={22} color={c.primaryDark} />
      <View style={s.info}><Text style={s.label}>Doluluk ve Mekânlar</Text></View>
      <MaterialCommunityIcons name={m.expanded ? 'chevron-up' : 'chevron-down'} size={24} color={c.primaryDark} />
    </Pressable>
    {m.expanded ? <View style={s.compactPanel}>
      <CafeArrivalStatusCard compact />
      <VenueProfilePrivacySetting compact />
      {presence.visit ? <CafeParticipationCard businessId={presence.visit.business_id} embedded showRequests={false} /> : null}
      <CafeSocialRequestsCard showEmpty />
    </View> : null}
  </View>;
});
