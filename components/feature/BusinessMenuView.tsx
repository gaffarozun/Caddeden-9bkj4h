import React, { memo } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useBusinessMenu } from '@/hooks/useBusinessMenu';
import { spacing } from '@/constants/theme';
import { useBusinessTheme } from '@/hooks/useBusinessTheme';
import { money } from '@/services/businessProfileService';
import { BusinessChips, BusinessError, BusinessHeader, BusinessLink, BusinessPrimary } from './BusinessProfileControls';
import { BusinessCheckoutSheet } from './BusinessCheckoutSheet';
import { PhotoViewer } from './PhotoViewer';
interface BusinessMenuViewProps { businessId: string }
export const BusinessMenuView = memo(function BusinessMenuView({ businessId }: BusinessMenuViewProps) {
  const { colors: c, styles: s, isDark } = useBusinessTheme();
  const m = useBusinessMenu(businessId); const p = m.profile; const b = p.business; const o = m.order;
  return <SafeAreaView style={s.screen} edges={['top', 'bottom']}><StatusBar style={isDark ? 'light' : 'dark'} /><View style={s.frame}><BusinessHeader title="Menü & Fiyatlar" onBack={() => p.router.back()} />
    {p.loading && !b ? <View style={s.center}><ActivityIndicator color={c.primary} /></View> : !b ? <View style={s.body}><BusinessError message={p.error} /></View> : <>
      <BusinessChips label="Menü kategorileri" items={m.groups.map(group => ({ id: group.name, label: group.name }))} selected={m.group?.name ?? ''} onSelect={m.setSelected} />
      <FlatList data={b.allowMenu === false ? [] : m.group?.items ?? []} keyExtractor={item => item.id} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxl }} refreshControl={<RefreshControl refreshing={p.refreshing} onRefresh={p.refresh} tintColor={c.primary} />} ItemSeparatorComponent={() => <View style={s.separator} />}
        ListHeaderComponent={<View><View style={s.menuBanner}>{m.banner ? <Image source={{ uri: m.banner }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : <View style={s.bannerCopy}><Text style={[s.subtle, s.gold]}>{b.name}</Text><Text style={s.bannerTitle}>{m.group?.name ?? 'Menü & Fiyatlar'}</Text></View>}</View><View style={s.body}><BusinessError message={p.error} />{p.orderingEnabled ? <><View style={s.delivery}><Text style={s.subtle}>Minimum {money(o.minimum)}</Text><Text style={s.subtle}>{b.avgDeliveryMinutes ? `Teslim ~${b.avgDeliveryMinutes} dk` : ''}</Text></View>{!p.status?.open ? <Text style={[s.subtle, { color: c.danger }]}>İşletme kapalı · Siparişinizi açıkken gönderebilirsiniz.</Text> : null}<BusinessLink label="Aktif siparişlerimi görüntüle" icon="script-text-outline" onPress={() => p.history('active')} /></> : null}</View></View>}
        renderItem={({ item }) => { const quantity = o.cart[item.id] ?? 0; return <View style={s.content}><View style={s.menuRow}>
          <Pressable disabled={!item.image} accessibilityLabel={`${item.name} fotoğrafını büyüt`} style={({ pressed }) => pressed ? s.pressed : null} onPress={() => m.setPhoto(item.image ?? null)}>{item.image ? <Image source={{ uri: item.image }} style={s.menuImage} contentFit="cover" transition={200} /> : <View style={s.menuImage}><MaterialCommunityIcons name="image-outline" size={24} color={c.textFaint} /></View>}</Pressable>
          <View style={s.info}><Text style={s.productTitle} numberOfLines={2}>{item.name}</Text>{item.description || item.tag ? <Text style={s.productDescription} numberOfLines={2}>{item.description || item.tag}</Text> : null}{quantity > 0 ? <View style={s.quantity}><Pressable disabled={o.busy} hitSlop={8} accessibilityLabel={`${item.name} azalt`} style={({ pressed }) => [s.quantityButton, pressed ? s.pressed : null]} onPress={() => o.add(item.id, -1)}><MaterialCommunityIcons name="minus" size={16} color={c.primary} /></Pressable><Text style={[s.small, s.gold]}>{quantity} adet</Text></View> : null}</View>
          {p.canOrder ? <View style={s.quantity}><Pressable disabled={o.busy} hitSlop={8} accessibilityLabel={`${item.name} sepete ekle`} style={({ pressed }) => [s.quantityButton, pressed ? s.pressed : null]} onPress={() => o.add(item.id, 1)}><MaterialCommunityIcons name="plus" size={17} color={c.primary} /></Pressable></View> : null}
          <Text style={s.price}>{money(item.price)}</Text>
        </View></View>; }}
        ListEmptyComponent={<View style={s.body}><Text style={s.subtle}>{b.allowMenu === false ? 'İşletme fiyat listesini şu anda paylaşmıyor.' : 'Bu kategoride henüz ürün veya hizmet bulunmuyor.'}</Text></View>}
      />
      {p.canOrder && o.count > 0 ? <View style={s.cartBar}><View style={s.info}><Text style={s.heading}>{money(o.total)}</Text><Text style={s.small}>{o.count} ürün{o.remaining > 0 ? ` · ${money(o.remaining)} daha ekle` : ''}</Text></View><BusinessPrimary label={o.remaining > 0 ? `Min. ${money(o.minimum)}` : 'Sipariş ver'} disabled={o.remaining > 0 || !p.status?.open || o.busy} onPress={o.checkout} /></View> : null}
      <BusinessCheckoutSheet model={o} deliveryMinutes={b.avgDeliveryMinutes} />
    </>}
    <PhotoViewer visible={!!m.photo} uri={m.photo} onClose={() => m.setPhoto(null)} />
  </View></SafeAreaView>;
});
