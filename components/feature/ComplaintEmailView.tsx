import React,{memo} from 'react';
import { ActivityIndicator,KeyboardAvoidingView,Platform,ScrollView,StyleSheet,Text,TextInput,View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useComplaintEmail } from '@/hooks/useComplaintEmail';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { FeedbackButton,FeedbackError,FeedbackInput } from './FeedbackControls';
import { fontSize,fontWeight,radius,spacing,ThemeColors } from '@/constants/theme';
interface ComplaintEmailViewProps {adminMode?:boolean;context?:string}
export const ComplaintEmailView=memo(function ComplaintEmailView({adminMode=false,context=''}:ComplaintEmailViewProps){
 const m=useComplaintEmail(adminMode,context);const {colors:c,styles:s}=useThemeStyles(createStyles);
 return <SafeAreaView style={s.screen} edges={['bottom']}><KeyboardAvoidingView style={s.screen} behavior={Platform.OS==='ios'?'padding':'height'}><ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
  <View style={s.hero}><MaterialCommunityIcons name={adminMode?'email-check-outline':'flag-outline'} size={32} color={c.primaryDark}/><Text style={s.title}>{adminMode?'Şikâyet e-posta adresi':'Bir durumu bildirin'}</Text><Text style={s.text}>{adminMode?'Kullanıcıların yazdığı şikâyetlerin gönderileceği e-posta adresini belirleyin. Bu adres tüm kullanıcılara görünür; yönetici giriş hesabınız değişmez.':'Yaşadığınız durumu yazın. Mesajınız yöneticinin belirlediği adrese göndermek üzere e-posta uygulamanızda taslak olarak açılır.'}</Text></View>
  {m.loading?<ActivityIndicator color={c.primary}/>:null}
  {adminMode?<View style={s.fields}><Text style={s.label}>Şikâyetlerin gönderileceği e-posta</Text><TextInput accessibilityLabel="Şikâyet e-posta adresi" value={m.email} onChangeText={m.setEmail} editable={!m.busy && !m.loading} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={254} placeholder="destek@ornek.com" placeholderTextColor={c.textFaint} style={s.input}/></View>:<>
   <View style={s.destination}><Text style={s.label}>Alıcı</Text><Text selectable style={s.text}>{m.email||'Yönetici henüz şikâyet adresi belirlememiş.'}</Text></View>
   {context?<Text style={s.subtle}>İlgili kayıt: {context}</Text>:null}
   <FeedbackInput label="Konu" multiline={false} maxLength={120} value={m.subject} onChange={m.setSubject} disabled={m.busy} placeholder="Siparişim, bir işletme veya uygulama hakkında"/>
   <FeedbackInput label="Durumu açıklayın" maxLength={4000} value={m.message} onChange={m.setMessage} disabled={m.busy} placeholder="Ne olduğunu ve ne zaman yaşandığını yazın."/>
  </>}
  <FeedbackError message={m.error}/>
  {m.notice?<View style={s.notice} accessibilityLiveRegion="polite"><MaterialCommunityIcons name="information-outline" size={22} color={c.primary}/><Text style={s.text}>{m.notice}</Text></View>:null}
  <FeedbackButton label={adminMode?'E-posta adresini kaydet':'E-posta taslağını aç'} icon={adminMode?'content-save-outline':'email-arrow-right-outline'} onPress={()=>{void m.submit();}} busy={m.busy} disabled={m.loading||(!adminMode&&!m.email)}/>
  {m.error || (!adminMode&&!m.email&&!m.loading)?<FeedbackButton secondary label="Adres bilgisini yeniden dene" onPress={()=>{void m.retry();}} disabled={m.busy||m.loading}/>:null}
  {!adminMode?<Text style={s.subtle}>Otomatik e-posta gönderilmez. E-posta uygulamasındaki Gönder düğmesine basmanız gerekir; gönderim sonucu bu uygulamadan doğrulanamaz.</Text>:null}
 </ScrollView></KeyboardAvoidingView></SafeAreaView>;
});
const createStyles=(c:ThemeColors)=>StyleSheet.create({screen:{flex:1,backgroundColor:c.background},content:{padding:spacing.lg,paddingBottom:spacing.xxxl,gap:spacing.lg,width:'100%',maxWidth:600,alignSelf:'center'},hero:{padding:spacing.xl,gap:spacing.md,borderRadius:radius.xl,backgroundColor:c.primarySoft,borderWidth:1,borderColor:c.brand},title:{fontSize:fontSize.xl,fontWeight:fontWeight.bold,color:c.text,includeFontPadding:false},text:{fontSize:fontSize.md,lineHeight:fontSize.md*1.6,color:c.text,flexShrink:1},subtle:{fontSize:fontSize.sm,lineHeight:fontSize.sm*1.6,color:c.textSubtle},label:{fontSize:fontSize.md,fontWeight:fontWeight.semibold,color:c.text},input:{minHeight:spacing.xxxl,padding:spacing.md,borderWidth:1,borderColor:c.borderStrong,borderRadius:radius.md,backgroundColor:c.surface,color:c.text,fontSize:fontSize.md},fields:{gap:spacing.sm},destination:{padding:spacing.lg,gap:spacing.sm,borderRadius:radius.lg,backgroundColor:c.surface},notice:{padding:spacing.md,flexDirection:'row',gap:spacing.sm,backgroundColor:c.primarySoft,borderRadius:radius.md}});
