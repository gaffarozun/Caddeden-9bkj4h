import { memo } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCafeParticipation } from '@/hooks/useCafeParticipation';
import { useCafeSocial } from '@/hooks/useCafeSocial';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { createCafeStyles } from '@/constants/cafeStyles';
import { CafeVisitPrivacyCard } from './CafeVisitPrivacyCard';
import { CafeOccupancyCard } from './CafeOccupancyCard';
import { CafeMemberCard } from './CafeMemberCard';
import { CafeSocialRequestsCard } from './CafeSocialRequestsCard';
import { VenueProfileChoice } from './VenueProfileChoice';
import { FeedbackButton, FeedbackError } from './FeedbackControls';
interface CafeParticipationCardProps { businessId: string; canManage?: boolean; embedded?: boolean; showRequests?: boolean; hasLocation?: boolean }
export const CafeParticipationCard = memo(function CafeParticipationCard({ businessId, canManage = false, embedded = false, showRequests = true, hasLocation }: CafeParticipationCardProps) {
 const m = useCafeParticipation(businessId, canManage); const social = useCafeSocial(); const router = useRouter();
 const { colors: c, styles: s } = useThemeStyles(createCafeStyles); const expanded = embedded || m.expanded;
 if (!canManage && !m.room) return m.error ? <FeedbackError message={m.error} /> : null;
 if (!m.available) return null;
 return <View style={s.accountSection}>
  {!embedded ? <Pressable accessibilityRole="button" accessibilityLabel="Doluluk ve mekândakiler" accessibilityState={{ expanded }} onPress={m.toggleExpanded} style={({ pressed }) => [s.venueButton, expanded ? s.venueButtonOpen : null, pressed ? s.pressed : null]}><MaterialCommunityIcons name="account-group-outline" color={c.primaryDark} size={22} /><View style={s.info}><Text style={s.label}>Doluluk ve Mekândakiler</Text></View><MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} color={c.primaryDark} size={22} /></Pressable> : null}
  {expanded ? <View style={s.venueSection}>
   {!m.room ? m.error ? <FeedbackError message={m.error} /> : <ActivityIndicator color={c.primary} accessibilityLabel="Mekân yükleniyor" /> : !m.room.enabled && !m.room.occupancy_enabled ? <Text style={s.text}>{hasLocation === false ? 'İşletme konumu eksik' : 'Katılım kullanılamıyor'}</Text> : <>
    <CafeOccupancyCard room={m.room} />
    {canManage ? <FeedbackButton compact secondary label="Doluluk ayarları" icon="store-cog-outline" onPress={() => router.push(`/business/manage/${businessId}`)} /> : m.active ? <>
     <CafeVisitPrivacyCard businessId={businessId} />
     {m.room.enabled && social.ready && social.handle ? <View style={s.card}>
      <View style={s.row}><MaterialCommunityIcons name="account-group-outline" size={22} color={c.primaryDark} /><Text style={s.title}>Mekândakiler · {m.room.count}</Text></View>
      <View style={s.peerRail}><FlatList horizontal data={m.members} keyExtractor={item => item.user_id} contentContainerStyle={s.members} showsHorizontalScrollIndicator={false} renderItem={({ item }) => <CafeMemberCard member={item} />} ListEmptyComponent={<Text style={s.text}>Başka katılımcı yok</Text>} /></View>
      <FeedbackError message={social.error} />
      {showRequests ? <CafeSocialRequestsCard localOnly /> : null}
     </View> : <FeedbackButton compact secondary label="Profilleri görmek için Instagram ekle" icon="instagram" onPress={() => router.push('/profile-edit')} />}
    </> : m.room.participation_enabled ? <View style={s.card}>
     {m.customer ? <>
      <VenueProfileChoice compact value={m.choice} enabled={m.presence.profileEnabled} busy={m.presence.busy} onChange={m.choose} />
      <FeedbackButton compact busy={m.presence.busy} label="Buradayım" icon="crosshairs-gps" onPress={() => { void m.join(); }} />
      <FeedbackError message={m.presence.error} />
     </> : !m.signedIn ? <FeedbackButton compact secondary label="Giriş yap" icon="login" onPress={() => router.push('/auth')} /> : null}
    </View> : null}
    <FeedbackError message={m.error} />
   </>}
  </View> : null}
 </View>;
});
