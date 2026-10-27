import React,{memo,useCallback} from 'react';
import { ActivityIndicator,Pressable,StyleSheet,Text,View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrderMessages } from '@/hooks/useOrderMessages';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { orderMessageText } from '@/services/orderMessageService';
import { fontSize,fontWeight,radius,shadow,spacing,ThemeColors } from '@/constants/theme';
interface OrderMessageBubbleProps {hidden?:boolean}
export const OrderMessageBubble=memo(function OrderMessageBubble({hidden=false}:OrderMessageBubbleProps){
 const m=useOrderMessages();const router=useRouter();const insets=useSafeAreaInsets();const {colors:c,styles:s}=useThemeStyles(createStyles);
 const open=useCallback(async()=>{if(await m.dismiss())router.push({pathname:'/history',params:{scope:'orders',mode:'all'}});},[m.dismiss,router]);
 if(hidden || !m.current)return null;
 return <View pointerEvents="box-none" style={[s.overlay,{top:insets.top+spacing.sm}]}>
  <View style={s.bubble} accessibilityLiveRegion="polite">
   <Pressable accessibilityRole="button" accessibilityLabel={`${m.current.business_name}. ${orderMessageText(m.current.status)} Siparişlerimi aç.`} disabled={m.busy} onPress={()=>{void open();}} style={({pressed})=>[s.main,pressed?s.pressed:null]}>
    <View style={s.icon}><MaterialCommunityIcons name={m.current.status==='on_the_way'?'truck-delivery-outline':m.current.status==='delivered'?'check-circle-outline':'food-outline'} size={24} color={c.primaryDark}/></View>
    <View style={s.copy}><Text style={s.brand}>SİPARİŞ BİLDİRİMİ{m.count>1?` · ${m.count}`:''}</Text><Text style={s.title} numberOfLines={1}>{m.current.business_name}</Text><Text style={s.text}>{orderMessageText(m.current.status)}</Text><Text style={s.hint}>#{m.current.order_id.slice(0,8)} · Siparişi görüntüle</Text></View>
   </Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel="Sipariş bildirimini kapat" disabled={m.busy} onPress={()=>{void m.dismiss();}} style={({pressed})=>[s.close,pressed?s.pressed:null]}>{m.busy?<ActivityIndicator color={c.primary}/>:<MaterialCommunityIcons name="close" size={22} color={c.textSubtle}/>}</Pressable>
  </View>
  {m.error?<Text style={s.error} accessibilityRole="alert">{m.error}</Text>:null}
 </View>;
});
const createStyles=(c:ThemeColors)=>StyleSheet.create({
 overlay:{position:'absolute',left:spacing.lg,right:spacing.lg,zIndex:100,alignItems:'center'},bubble:{width:'100%',maxWidth:600,flexDirection:'row',alignItems:'flex-start',backgroundColor:c.surface,borderWidth:1,borderColor:c.brand,borderRadius:radius.xxl,...shadow.lg},
 main:{flex:1,flexDirection:'row',alignItems:'center',gap:spacing.md,padding:spacing.lg},copy:{flex:1,gap:spacing.xs},icon:{width:spacing.xxxl,height:spacing.xxxl,alignItems:'center',justifyContent:'center',backgroundColor:c.primarySoft,borderRadius:radius.lg},
 brand:{color:c.primaryDark,fontSize:fontSize.xs,fontWeight:fontWeight.bold},title:{color:c.text,fontSize:fontSize.md,fontWeight:fontWeight.bold,includeFontPadding:false},text:{color:c.text,fontSize:fontSize.md,lineHeight:fontSize.md*1.6},hint:{color:c.textSubtle,fontSize:fontSize.xs},close:{width:spacing.xxxl,height:spacing.xxxl,alignItems:'center',justifyContent:'center'},pressed:{opacity:0.7},error:{color:c.danger,backgroundColor:c.dangerSoft,padding:spacing.sm,borderRadius:radius.md,fontSize:fontSize.sm,maxWidth:600},
});
