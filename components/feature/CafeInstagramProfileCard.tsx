import React, { memo } from 'react';
import { Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCafeInstagramProfile } from '@/hooks/useCafeInstagramProfile';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { createCafeStyles } from '@/constants/cafeStyles';
import { FeedbackButton, FeedbackError } from './FeedbackControls';
interface CafeInstagramProfileCardProps { compact?: boolean }
export const CafeInstagramProfileCard = memo(function CafeInstagramProfileCard({ compact = false }: CafeInstagramProfileCardProps) {
 const m = useCafeInstagramProfile(); const { colors: c, styles: s } = useThemeStyles(createCafeStyles);
 if (!m.customer) return null;
 return <View style={s.card}>
  <View style={s.row}><MaterialCommunityIcons name="lock-outline" size={28} color={c.primaryDark} /><Text style={s.title}>Instagram gizliliği</Text></View>
  <Text style={s.text}>Kullanıcı adınız herkese gösterilmez. Yalnızca izin verdiğiniz kişi, ikiniz de aynı mekâna aktif katılmışken Instagram profilinizi açabilir.</Text>
  {!compact ? <Text style={s.text}>Reddederseniz, isteği gönderen kişi adınızı ve fotoğrafınızı 1 hafta göremez; sizi yalnızca Kullanıcı olarak görür. İzin verdiğiniz erişimi Profil bölümünden kaldırabilirsiniz. Daha önce görülen bir Instagram adresi geri alınamaz.</Text> : null}
  <Text style={s.text}>Gönderdiğiniz farklı kişi sayısı size ve isteği alan kişiye Instagram görme istekleri bölümünde gösterilir.</Text>
  <Text style={s.label}>Instagram kullanıcı adı (isteğe bağlı)</Text>
  <TextInput accessibilityLabel="Instagram kullanıcı adı" placeholder="kullanici_adi" placeholderTextColor={c.textFaint} value={m.value} onChangeText={m.setValue} autoCapitalize="none" autoCorrect={false} maxLength={31} editable={!m.busy && m.ready} style={s.input} />
  <FeedbackButton secondary busy={m.busy} disabled={!m.ready || !m.value.trim()} label="Instagram kullanıcı adını kaydet" icon="content-save-outline" onPress={() => { void m.save(); }} />
  <FeedbackError message={m.error} />
  {m.notice ? <Text accessibilityLiveRegion="polite" style={s.text}>{m.notice}</Text> : null}
 </View>;
});
