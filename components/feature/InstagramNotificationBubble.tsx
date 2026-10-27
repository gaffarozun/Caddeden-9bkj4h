import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useInstagramNotificationBubble } from '@/hooks/useInstagramNotificationBubble';
import { useOrderMessages } from '@/hooks/useOrderMessages';
import { useOrderRatings } from '@/hooks/useOrderRatings';
import { useBubbleViewport } from '@/hooks/useBubbleViewport';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { fontSize, fontWeight, radius, shadow, spacing, ThemeColors } from '@/constants/theme';
interface InstagramNotificationBubbleProps { hidden?:boolean }
export const InstagramNotificationBubble=memo(function InstagramNotificationBubble({hidden=false}:InstagramNotificationBubbleProps){
 const m=useInstagramNotificationBubble(); const orders=useOrderMessages();const ratings=useOrderRatings();const viewport=useBubbleViewport();const {colors:c,styles:s}=useThemeStyles(createStyles);
 if(hidden || orders.current || ratings.current || ratings.notice || !m.current)return null;
 return <View pointerEvents="box-none" style={[s.overlay,{top:viewport.top}]}><View style={s.bubble} accessibilityLiveRegion="polite"><Pressable accessibilityRole="button" accessibilityLabel={`${m.current.body} Bildirimleri aç`} onPress={m.open} style={({pressed})=>[s.main,pressed?s.pressed:null]}><MaterialCommunityIcons name="account-check-outline" size={28} color={c.primaryDark}/><View style={s.copy}><Text style={s.title}>Instagram</Text><Text style={s.text}>{m.current.body}</Text></View></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Bulutu kapat" onPress={m.dismiss} style={({pressed})=>[s.close,pressed?s.pressed:null]}><MaterialCommunityIcons name="close" size={24} color={c.textSubtle}/></Pressable></View></View>;
});
const createStyles=(c:ThemeColors)=>StyleSheet.create({overlay:{position:'absolute',left:spacing.lg,right:spacing.lg,zIndex:100,alignItems:'center'},bubble:{width:'100%',maxWidth:600,borderRadius:radius.xxl,borderWidth:1,borderColor:c.brand,backgroundColor:c.surface,flexDirection:'row',...shadow.lg},main:{flex:1,flexDirection:'row',alignItems:'center',gap:spacing.md,padding:spacing.lg},copy:{flex:1,gap:spacing.xs},title:{fontSize:fontSize.md,color:c.primaryDark,fontWeight:fontWeight.bold},text:{fontSize:fontSize.md,color:c.text,lineHeight:fontSize.md*1.6},close:{width:spacing.xxxl,height:spacing.xxxl,alignItems:'center',justifyContent:'center'},pressed:{opacity:0.7}});
