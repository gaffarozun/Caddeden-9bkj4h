import { memo } from 'react';
import { Switch, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useVenueProfilePreference } from '@/hooks/useVenueProfilePreference';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { createCafeStyles } from '@/constants/cafeStyles';
import { FeedbackError } from './FeedbackControls';
interface VenueProfilePrivacySettingProps { compact?: boolean }
export const VenueProfilePrivacySetting = memo(function VenueProfilePrivacySetting({ compact = false }: VenueProfilePrivacySettingProps) {
 const { authUser } = useAuth(); const m = useVenueProfilePreference(); const { colors: c, styles: s } = useThemeStyles(createCafeStyles);
 if (authUser?.role !== 'user') return null;
 return <View style={compact ? s.scanNotice : s.card}>
  <View style={s.row}><MaterialCommunityIcons name="shield-account-outline" color={c.primaryDark} size={26} /><View style={s.info}><Text style={s.label}>{compact ? 'Profil paylaşımı' : 'Mekânlarda profilimi paylaşabilirim'}</Text>{!compact ? <Text style={s.text}>Genel gizlilik tercihiniz</Text> : null}</View><Switch accessibilityLabel="Mekânlarda isim ve profil fotoğrafı paylaşımına izin ver" accessibilityState={{ disabled: !m.ready || m.busy }} disabled={!m.ready || m.busy} value={m.visible} onValueChange={value => { void m.setVisible(value); }} trackColor={{ true: c.primary, false: c.border }} thumbColor={c.onPrimary} /></View>
  {!compact ? <Text style={s.text}>{m.visible ? 'Her girişte ayrıca Göster veya Gizle seçersiniz. Göster seçilirse adınız, sansürlü soyadınız ve fotoğrafınız görünür.' : 'İsminiz ve fotoğrafınız hiçbir mekânda paylaşılmaz. Onaylı katılımınız doluluğa dahil olur; diğerleri sizi yalnızca Kullanıcı olarak görür.'}</Text> : null}
  <FeedbackError message={m.error} />
 </View>;
});
