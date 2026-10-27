import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useVenueProfileChoice } from '@/hooks/useVenueProfileChoice';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { createCafeStyles } from '@/constants/cafeStyles';
import { VenueProfilePrivacySetting } from './VenueProfilePrivacySetting';
interface VenueProfileChoiceProps { compact?: boolean; value: boolean; enabled: boolean; busy: boolean; onChange: (visible: boolean) => void }
export const VenueProfileChoice = memo(function VenueProfileChoice({ value, enabled, busy, onChange, compact = false }: VenueProfileChoiceProps) {
 const m = useVenueProfileChoice(value, enabled, busy, onChange); const { colors: c, styles: s } = useThemeStyles(createCafeStyles);
 return <View style={compact ? s.compactPanel : s.panel}>
  <VenueProfilePrivacySetting compact />
  <Text style={s.label}>{compact ? 'Bu girişte profilim' : 'Bu girişte adınız ve profil fotoğrafınız'}</Text>
  <View style={s.choiceRow}>
   <Pressable accessibilityRole="radio" accessibilityLabel="Adımı ve fotoğrafımı gizle" accessibilityState={{ checked: !m.visible, disabled: busy }} disabled={busy} onPress={() => m.choose(false)} style={({ pressed }) => [s.choice, !m.visible ? s.selected : null, pressed ? s.pressed : null]}><MaterialCommunityIcons name="eye-off-outline" color={c.primaryDark} size={24} /><Text style={s.label}>Gizle</Text></Pressable>
   <Pressable accessibilityRole="radio" accessibilityLabel="Adımı ve fotoğrafımı göster" accessibilityState={{ checked: m.visible, disabled: m.showDisabled }} disabled={m.showDisabled} onPress={() => m.choose(true)} style={({ pressed }) => [s.choice, m.visible ? s.selected : null, pressed ? s.pressed : null]}><MaterialCommunityIcons name="eye-outline" color={c.primaryDark} size={24} /><Text style={s.label}>Göster</Text></Pressable>
  </View>
  {!compact ? <Text style={s.text}>Gizliyken yalnızca Kullanıcı olarak görünürsünüz; doluluğa dahil olur ve diğer katılımcıları görebilirsiniz. Instagram erişimi ayrıca izin gerektirir.</Text> : null}
 </View>;
});
