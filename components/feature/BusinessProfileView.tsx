import React, { memo } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useBusinessProfile } from '@/hooks/useBusinessProfile';
import { spacing } from '@/constants/theme';
import { useBusinessTheme } from '@/hooks/useBusinessTheme';
import { categoryLabel } from '@/services/categories';
import { money } from '@/services/businessProfileService';
import { BusinessAction, BusinessError, BusinessLink } from './BusinessProfileControls';
import { PhotoViewer } from './PhotoViewer';
import { CafeParticipationCard } from './CafeParticipationCard';
const tabs = [{ id: 'about', label: 'Hakkında' }, { id: 'photos', label: 'Fotoğraflar' }, { id: 'events', label: 'Etkinlikler' }, { id: 'reviews', label: 'Değerlendirin' }];
interface BusinessProfileViewProps { businessId: string }
export const BusinessProfileView = memo(function BusinessProfileView({ businessId }: BusinessProfileViewProps) {
  const { colors: c, styles: s, isDark } = useBusinessTheme();
  const m = useBusinessProfile(businessId); const b = m.business;
  if (m.loading && !b) return <SafeAreaView style={s.screen}><View style={s.center}><ActivityIndicator color={c.primary} /></View></SafeAreaView>;
  if (!b) return <SafeAreaView style={s.screen}><View style={s.center}><BusinessError message={m.error} /><BusinessLink icon="arrow-left" label="Geri dön" onPress={() => m.router.back()} /></View></SafeAreaView>;
  const rows = m.tab === 'photos' ? b.images.map((image, index) => ({ id: `photo-${index}`, image, title: '' })) : m.tab === 'events' ? [
    ...(m.data?.campaigns ?? []).map(item => ({ id: item.id, image: '', title: item.description ? `${item.title}\n${item.description}` : item.title })),
    ...(m.data?.events ?? []).map(item => ({ id: item.id, image: item.image, title: item.title })),
  ] : [];
  const campaign = m.data?.campaigns[0];
  return <SafeAreaView style={s.screen} edges={['top', 'bottom']}><StatusBar style={isDark ? 'light' : 'dark'} /><View style={s.frame}>
    <FlatList data={rows} keyExtractor={item => item.id} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxl }} refreshControl={<RefreshControl refreshing={m.refreshing} onRefresh={m.refresh} tintColor={c.primary} />} ItemSeparatorComponent={() => <View style={s.separator} />} renderItem={({ item }) => <View style={s.content}>{item.image ? <Pressable onPress={() => m.setPhotoUri(item.image)} style={({ pressed }) => pressed ? s.pressed : null}><Image source={{ uri: item.image }} style={s.galleryImage} contentFit="cover" transition={200} /></Pressable> : null}{item.title ? <View style={s.card}><Text style={s.text}>{item.title}</Text></View> : null}</View>}
      ListHeaderComponent={<View>
        <View style={s.hero}>{b.cover ? <Image source={{ uri: b.cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}<View style={s.coverNav}><Pressable style={({ pressed }) => [s.iconButton, pressed ? s.pressed : null]} accessibilityLabel="Geri dön" onPress={() => m.router.back()}><MaterialCommunityIcons name="chevron-left" size={30} color={c.white} /></Pressable><View style={s.spacer} />{m.customer ? <Pressable style={({ pressed }) => [s.iconButton, pressed ? s.pressed : null]} accessibilityLabel={m.saved ? 'Kaydı kaldır' : 'İşletmeyi kaydet'} onPress={m.toggleSave}><MaterialCommunityIcons name={m.saved ? 'bookmark' : 'bookmark-outline'} size={25} color={m.saved ? c.brand : c.white} /></Pressable> : null}<Pressable style={({ pressed }) => [s.iconButton, pressed ? s.pressed : null]} accessibilityLabel="İşletmeyi paylaş" onPress={() => { void m.share(); }}><MaterialCommunityIcons name="share-variant-outline" size={24} color={c.white} /></Pressable></View></View>
        <View style={s.body}>
          <View style={s.identity}><View style={s.info}><Text style={s.title}>{b.name}</Text><View style={s.meta}><MaterialCommunityIcons name="star" size={18} color={c.primary} /><Text style={[s.subtle, s.gold, s.bold]}>{Number(b.rating).toFixed(1)}</Text><Text style={s.subtle}>({b.reviewCount}) · {categoryLabel(b.category)}{b.distanceKm > 0 ? ` · ${b.distanceKm < 1 ? `${Math.round(b.distanceKm * 1000)} m` : `${b.distanceKm.toFixed(1)} km`}` : ''}</Text></View><View style={s.meta}><View style={[s.dot, { backgroundColor: m.status?.open ? c.success : c.danger }]} /><Text style={[s.subtle, { color: m.status?.open ? c.success : c.danger }]}>{m.status?.open ? 'Açık' : 'Kapalı'}</Text><Text style={s.subtle}>{b.hours ? `· ${b.hours}` : ''}</Text></View></View><View style={s.logo}>{b.logo ? <Image source={{ uri: b.logo }} style={s.image} contentFit="cover" transition={200} /> : <MaterialCommunityIcons name="storefront-outline" color={c.primary} size={28} />}</View></View>
          {m.data?.isDemo ? <Text style={s.small}>Demo işletme · Gerçek sipariş ve rezervasyon alınmaz</Text> : null}
          <View style={s.actions}><BusinessAction icon="phone-outline" label="Ara" onPress={m.call} /><BusinessAction icon="map-marker-outline" label="Konum" onPress={m.maps} />{m.customer ? <BusinessAction icon={m.saved ? 'bookmark' : 'bookmark-outline'} label={m.saved ? 'Kaydedildi' : 'Kaydet'} selected={m.saved} onPress={m.toggleSave} /> : null}<BusinessAction icon="export-variant" label="Paylaş" onPress={() => { void m.share(); }} /></View>
          {m.orderingEnabled ? <View style={s.delivery}><View style={s.meta}><MaterialCommunityIcons name="cart-outline" size={18} color={c.primary} /><Text style={s.subtle}>Min. {money(b.minOrder ?? 0)}</Text></View><View style={s.meta}><MaterialCommunityIcons name="bike-fast" size={18} color={c.primary} /><Text style={s.subtle}>{b.avgDeliveryMinutes ? `~${b.avgDeliveryMinutes} dk` : 'Teslim süresi belirtilmedi'}</Text></View></View> : null}
          {!m.data?.isDemo ? <CafeParticipationCard businessId={b.id} canManage={m.canManage} hasLocation={b.lat != null && b.lng != null} /> : null}
          {(b.allowMenu ?? b.hasMenu) ? <BusinessLink featured icon="book-open-page-variant-outline" label="Menü & Fiyatlar" onPress={() => m.router.push(`/business/menu/${b.id}`)} /> : null}
          {m.canReserve ? <BusinessLink icon="calendar-outline" label={m.sub?.hasAppointment ? 'Randevu al' : 'Rezervasyon yap'} onPress={() => m.router.push(`/business/reserve/${b.id}`)} /> : null}
          {m.canManage ? <BusinessLink icon="store-cog-outline" label="İşletme sayfamı düzenle" onPress={() => m.router.push(`/business/manage/${b.id}`)} /> : null}
          {campaign ? <Pressable accessibilityRole="button" style={({ pressed }) => [s.campaign, pressed ? s.pressed : null]} onPress={() => m.setTab('events')}><View style={s.campaignIcon}><MaterialCommunityIcons name="percent-outline" size={24} color={c.danger} /></View><View style={s.info}><Text style={[s.productTitle]} numberOfLines={1}>{campaign.title}</Text>{campaign.description ? <Text style={s.subtle} numberOfLines={1}>{campaign.description}</Text> : null}</View><MaterialCommunityIcons name="chevron-right" size={22} color={c.textSubtle} /></Pressable> : null}
          <BusinessError message={m.error} />
        </View>
        <View style={[s.actions, s.tabs]}>{tabs.map(item => <Pressable key={item.id} onPress={() => m.setTab(item.id)} accessibilityRole="tab" accessibilityState={{ selected: m.tab === item.id }} style={({ pressed }) => [s.tab, m.tab === item.id ? s.tabActive : null, pressed ? s.pressed : null]}><Text style={[s.actionLabel, m.tab === item.id ? s.gold : null]}>{item.label}</Text></Pressable>)}</View>
        <View style={s.body}><Text style={s.heading}>{tabs.find(item => item.id === m.tab)?.label}</Text>
          {m.tab === 'about' ? <><Text style={s.text}>{b.description || 'İşletme henüz açıklama eklememiş.'}</Text>{b.profileTags?.length ? <View><FlatList horizontal data={b.profileTags} keyExtractor={(item, index) => `${item}-${index}`} contentContainerStyle={s.tags} showsHorizontalScrollIndicator={false} renderItem={({ item }) => <View style={s.tag}><Text style={s.subtle}>{item}</Text></View>} /></View> : null}{b.images[0] ? <Pressable style={({ pressed }) => pressed ? s.pressed : null} onPress={() => m.setPhotoUri(b.images[0])}><Image source={{ uri: b.images[0] }} style={s.aboutImage} contentFit="cover" transition={200} /></Pressable> : null}{b.address ? <Text style={s.subtle}>{b.address}</Text> : null}</> : null}
          {m.tab === 'reviews' ? m.customer ? <BusinessLink featured icon="star-outline" label="İşletmeyi değerlendir" onPress={() => m.router.push(`/business/rate/${b.id}`)} /> : <Text style={s.subtle}>Puanlama yalnızca müşteri hesaplarına açıktır.</Text> : null}
          {(m.tab === 'photos' || m.tab === 'events') && rows.length === 0 ? <Text style={s.subtle}>{m.tab === 'photos' ? 'Henüz fotoğraf eklenmemiş.' : 'Henüz etkinlik veya kampanya paylaşılmamış.'}</Text> : null}
        </View>
      </View>} />
    <PhotoViewer visible={!!m.photoUri} uri={m.photoUri} onClose={() => m.setPhotoUri(null)} />
  </View></SafeAreaView>;
});
