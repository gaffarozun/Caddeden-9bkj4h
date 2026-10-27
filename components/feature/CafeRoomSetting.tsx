import { memo } from 'react';
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { createCafeStyles } from '@/constants/cafeStyles';
interface CafeRoomSettingProps { businessId: string }
export const CafeRoomSetting=memo(function CafeRoomSetting({}:CafeRoomSettingProps){
 const {colors:c,styles:s}=useThemeStyles(createCafeStyles);
 return <View style={s.card}><View style={s.row}><MaterialCommunityIcons name="account-group-outline" size={28} color={c.primaryDark}/><Text style={s.title}>Mekândakiler</Text></View><Text style={s.text}>Konumu kayıtlı ve yayındaki işletmelerde otomatik açıktır. Müşteriler kendi profil görünürlüğünü seçer.</Text></View>;
});
