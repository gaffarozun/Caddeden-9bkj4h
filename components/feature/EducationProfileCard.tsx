import { memo } from 'react';
import { Text, View } from 'react-native';
import { useEducationProfile } from '@/hooks/useEducationProfile';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { createCafeStyles } from '@/constants/cafeStyles';
import { educationOptions } from '@/services/educationService';
import { FeedbackButton, FeedbackChips, FeedbackError, FeedbackInput } from './FeedbackControls';
interface EducationProfileCardProps {}
export const EducationProfileCard=memo(function EducationProfileCard({}:EducationProfileCardProps){
 const m=useEducationProfile(); const {styles:s}=useThemeStyles(createCafeStyles);
 return <View style={s.card}><Text style={s.title}>Eğitim bilgilerim</Text>
  <FeedbackChips label="Eğitim durumum" items={educationOptions} selected={m.status} onSelect={m.setStatus} disabled={m.busy}/>
  {m.active?<FeedbackInput label="Aktif olarak okuduğum okul" value={m.school} onChange={m.setSchool} maxLength={120} multiline={false} disabled={m.busy} placeholder="Üniversite veya okul adı"/>:null}
  <Text style={s.text}>Beyanınıza göre gösterilir; okul bilgisi yalnızca görünür profilinizdeki mekân katılımcılarına açılır.</Text>
  <FeedbackButton secondary busy={m.busy} label="Eğitim bilgisini kaydet" icon="school-outline" onPress={()=>{void m.save();}}/>
  <FeedbackError message={m.error}/>{m.notice?<Text style={s.text} accessibilityLiveRegion="polite">{m.notice}</Text>:null}
 </View>;
});
