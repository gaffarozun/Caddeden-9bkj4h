import { memo } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationInbox } from '@/hooks/useNotificationInbox';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
import { FeedbackButton, FeedbackError } from './FeedbackControls';
interface NotificationInboxViewProps {}
export const NotificationInboxView=memo(function NotificationInboxView({}:NotificationInboxViewProps){
 const m=useNotificationInbox();const {authUser}=useAuth();const {colors:c,styles:s}=useThemeStyles(createStyles);
 if(authUser?.role!=='user')return <SafeAreaView style={s.screen}><Text style={s.text}>Bildirimler müşteri hesabınıza özeldir.</Text></SafeAreaView>;
 return <SafeAreaView style={s.screen} edges={['bottom']}>
  <FlatList data={m.items} keyExtractor={item=>item.id} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={m.loading} onRefresh={()=>{void m.refresh();}} tintColor={c.primary}/>} ListHeaderComponent={<View style={s.overview}><MaterialCommunityIcons name="bell-outline" size={30} color={c.primaryDark}/><View style={s.copy}><Text style={s.title}>Bildirim kutum</Text><Text style={s.text}>{m.unread} okunmamış · Siparişler ve Instagram</Text></View></View>} ListEmptyComponent={<View style={s.empty}>{m.loading?<ActivityIndicator color={c.primary}/>:<MaterialCommunityIcons name="bell-sleep-outline" size={48} color={c.textFaint}/>}<Text style={s.text}>{m.loading?'Bildirimler yükleniyor':'Henüz bildirim yok'}</Text></View>} ListFooterComponent={<FeedbackError message={m.error}/>} renderItem={({item})=><View style={[s.card,!item.read_at?s.unread:null]}>
   <Pressable disabled={m.busy} accessibilityRole="button" accessibilityLabel={`${item.title}. ${item.body}${item.read_at?'':' Okunmamış'}`} accessibilityState={{expanded:m.selected===item.id}} onPress={()=>{void m.select(item);}} style={({pressed})=>[s.row,pressed?s.pressed:null]}>
    <View style={s.icon}><MaterialCommunityIcons name={item.kind==='order'?'truck-delivery-outline':'account-check-outline'} size={24} color={c.primaryDark}/></View>
    <View style={s.copy}><Text style={s.label}>{item.title}</Text><Text style={s.text} numberOfLines={m.selected===item.id?undefined:2}>{item.body}</Text><Text style={s.date}>{new Date(item.created_at).toLocaleString('tr-TR')}</Text></View>
    {!item.read_at?<View style={s.dot}/>:<MaterialCommunityIcons name="check" size={18} color={c.textSubtle}/>}
   </Pressable>
   {m.selected===item.id?<View style={s.detail}><Text style={s.text}>{item.kind==='order'?`Sipariş #${item.order_id?.slice(0,8)??''}`:'Profil ve Instagram erişimi yalnızca aynı mekânda konum doğrulamasıyla açılır.'}</Text><FeedbackButton secondary label={item.kind==='order'?'Siparişlerimi aç':'Mekânı ve istekleri aç'} icon="chevron-right" onPress={()=>m.openDestination(item)}/></View>:null}
  </View>}/>
 </SafeAreaView>;
});
const createStyles=(c:ThemeColors)=>StyleSheet.create({screen:{flex:1,backgroundColor:c.background},content:{padding:spacing.lg,gap:spacing.md,paddingBottom:spacing.xxl},overview:{flexDirection:'row',alignItems:'center',gap:spacing.md,padding:spacing.lg,backgroundColor:c.primarySoft,borderRadius:radius.lg,borderWidth:1,borderColor:c.brand,marginBottom:spacing.sm},title:{fontSize:fontSize.xl,fontWeight:fontWeight.bold,color:c.primaryDark},text:{fontSize:fontSize.md,color:c.textSubtle,lineHeight:fontSize.md*1.6},label:{fontSize:fontSize.md,fontWeight:fontWeight.semibold,color:c.text},copy:{flex:1,gap:spacing.xs},card:{backgroundColor:c.surface,borderWidth:1,borderColor:c.border,borderRadius:radius.lg,overflow:'hidden'},unread:{borderColor:c.brand,backgroundColor:c.surfaceAlt},row:{flexDirection:'row',alignItems:'center',padding:spacing.lg,gap:spacing.md,minHeight:spacing.xxxl},icon:{width:spacing.xxxl,height:spacing.xxxl,borderRadius:radius.lg,backgroundColor:c.primarySoft,alignItems:'center',justifyContent:'center'},date:{fontSize:fontSize.sm,color:c.textSubtle},dot:{width:spacing.sm,height:spacing.sm,borderRadius:radius.pill,backgroundColor:c.primary},pressed:{opacity:0.7},detail:{padding:spacing.lg,paddingTop:0,gap:spacing.md},empty:{alignItems:'center',paddingVertical:spacing.xxxl,gap:spacing.md}});
