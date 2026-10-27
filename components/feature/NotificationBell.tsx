import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerInbox } from '@/hooks/useCustomerInbox';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
interface NotificationBellProps {}
export const NotificationBell=memo(function NotificationBell({}:NotificationBellProps){
 const {authUser}=useAuth();const inbox=useCustomerInbox();const router=useRouter();const {colors:c,styles:s}=useThemeStyles(createStyles);
 if(authUser?.role!=='user')return null;
 return <Pressable accessibilityRole="button" accessibilityLabel={`Bildirimler, ${inbox.unread} okunmamış`} onPress={()=>router.push('/notifications')} style={({pressed})=>[s.button,pressed?s.pressed:null]}><MaterialCommunityIcons name="bell-outline" color={c.primaryDark} size={26}/>{inbox.unread>0?<View style={s.badge}><Text style={s.count}>{inbox.unread>99?'99+':inbox.unread}</Text></View>:null}</Pressable>;
});
const createStyles=(c:ThemeColors)=>StyleSheet.create({button:{width:spacing.xxxl,height:spacing.xxxl,borderRadius:radius.pill,backgroundColor:c.surface,borderWidth:1,borderColor:c.brand,alignItems:'center',justifyContent:'center'},pressed:{opacity:0.7,transform:[{scale:0.96}]},badge:{position:'absolute',right:-spacing.xs,top:-spacing.xs,minWidth:spacing.xl,height:spacing.xl,borderRadius:radius.pill,paddingHorizontal:spacing.xs,alignItems:'center',justifyContent:'center',backgroundColor:c.primary},count:{color:c.onPrimary,fontSize:fontSize.xs,fontWeight:fontWeight.bold}});
