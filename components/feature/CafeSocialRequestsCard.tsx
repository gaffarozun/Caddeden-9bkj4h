import React, { memo } from 'react';
import { FlatList, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCafeSocial } from '@/hooks/useCafeSocial';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { createCafeStyles } from '@/constants/cafeStyles';
import { CafePhoto } from './CafePhoto';
import { FeedbackButton, FeedbackError } from './FeedbackControls';
interface CafeSocialRequestsCardProps { showEmpty?: boolean; localOnly?: boolean }
export const CafeSocialRequestsCard = memo(function CafeSocialRequestsCard({ showEmpty = false, localOnly = false }: CafeSocialRequestsCardProps) {
 const m = useCafeSocial(localOnly); const { colors: c, styles: s } = useThemeStyles(createCafeStyles);
 if (!showEmpty && m.incoming.length === 0 && m.sentRecipientCount === 0) return null;
 return <View style={s.card}>
  <View style={s.row}><MaterialCommunityIcons name="account-check-outline" size={22} color={c.primaryDark} /><Text style={s.title}>Instagram istekleri</Text></View>
  <View style={s.badge}><Text style={s.badgeText}>Gönderilen · {m.sentRecipientCount}</Text></View>
  <View style={s.requestRail}><FlatList horizontal data={m.incoming} keyExtractor={item => item.id} contentContainerStyle={s.members} showsHorizontalScrollIndicator={false} ListEmptyComponent={<Text style={s.text}>Henüz istek yok</Text>} renderItem={({ item }) => <View style={s.requestCard}>
   <View style={s.row}><CafePhoto path={item.photo_path ?? null} name={item.name ?? 'Kullanıcı'} size={48} /><Text style={s.label}>{item.name ?? 'Kullanıcı'}</Text></View>
   <Text style={s.text}>{Number(item.requester_sent_count ?? 0)} kişiye istek gönderdi</Text>
   {item.status === 'pending' ? <>
    <FeedbackButton compact busy={m.busy} disabled={!m.ready || !item.can_accept || !m.handle} label="Kabul et" icon="check" onPress={() => { void m.decide(item.id, true); }} />
    {!m.handle ? <Text style={s.text}>Önce Instagram ekleyin</Text> : !item.can_accept ? <Text style={s.peerHint}>Onay kullanılamıyor</Text> : null}
   </> : <>
    
    <FeedbackButton compact secondary busy={m.busy} disabled={!m.ready || !m.handle || !item.can_open} label="Instagramı aç" icon="open-in-new" onPress={() => { void m.open(item.id); }} />
   </>}
   <FeedbackButton compact secondary busy={m.busy} label={item.status === 'accepted' ? 'İzni kaldır' : 'Reddet'} icon="close" onPress={() => { void (item.status === 'accepted' ? m.revoke(item.id) : m.decide(item.id, false)); }} />
  </View>} /></View>
  {m.outgoing.some(item => item.status === 'accepted' || item.status === 'pending') ? <>
   <Text style={s.label}>Gönderdiğim istekler</Text>
   <View style={s.requestRail}><FlatList horizontal data={m.outgoing.filter(item => item.status === 'accepted' || item.status === 'pending')} keyExtractor={item => item.id} showsHorizontalScrollIndicator={false} contentContainerStyle={s.members} renderItem={({ item }) => <View style={s.requestCard}>
    <Text style={s.label}>{item.status === 'accepted' ? 'Karşılıklı izin' : 'Onay bekleniyor'}</Text>
    
    {item.status === 'accepted' ? <FeedbackButton compact secondary busy={m.busy} disabled={!m.handle || !item.can_open} label="Instagramı aç" icon="open-in-new" onPress={() => { void m.open(item.id); }} /> : null}
    <FeedbackButton compact secondary busy={m.busy} label={item.status === 'accepted' ? 'İzni kaldır' : 'İsteği geri çek'} icon="account-minus-outline" onPress={() => { void m.revoke(item.id); }} />
   </View>} /></View>
  </> : null}
  <FeedbackError message={m.error} />
 </View>;
});
