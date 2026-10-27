import React, { memo } from 'react';
import { FlatList, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useBusinessAppearance } from '@/hooks/useBusinessAppearance';
import { useBusinessTheme } from '@/hooks/useBusinessTheme';
import { BusinessError, BusinessLink, BusinessPrimary } from './BusinessProfileControls';
interface BusinessAppearanceEditorProps { businessId: string; menuVersion: string }
export const BusinessAppearanceEditor = memo(function BusinessAppearanceEditor({ businessId, menuVersion }: BusinessAppearanceEditorProps) {
  const { colors: c, styles: s } = useBusinessTheme();
  const m = useBusinessAppearance(businessId);
  React.useEffect(() => { void m.loadGroups().catch(() => {}); }, [menuVersion, m.loadGroups]);
  return <View style={s.card}><Text style={s.heading}>Profil ve menü görünümü</Text><Text style={s.subtle}>Üst menü fotoğrafı ve kategori fotoğrafları doğrudan kaydedilir; yönetici onayı gerekmez. Fotoğraflar otomatik kırpılmaz, yatay görseller önerilir.</Text>
    <Text style={s.text}>Google Haritalar bağlantısı</Text><TextInput style={s.input} accessibilityLabel="Google Haritalar işletme bağlantısı" placeholder="https://maps.app.goo.gl/…" placeholderTextColor={c.textFaint} value={m.mapsUrl} onChangeText={m.setMapsUrl} autoCapitalize="none" keyboardType="url" editable={!m.busy} />
    <Text style={s.text}>Hakkında etiketleri (virgülle ayırın)</Text><TextInput style={s.input} accessibilityLabel="İşletme profil etiketleri" placeholder="Deniz manzarası, Canlı müzik" placeholderTextColor={c.textFaint} value={m.tags} onChangeText={m.setTags} editable={!m.busy} maxLength={400} />
    <BusinessPrimary label="Profil bağlantısını ve etiketleri kaydet" busy={m.busy === 'settings'} disabled={!!m.busy} onPress={() => { void m.save(); }} />
    <Text style={s.heading}>Menü üst fotoğrafı</Text>{m.menuCover ? <Image source={{ uri: m.menuCover }} style={s.aboutImage} contentFit="cover" transition={200} /> : null}<BusinessLink icon="image-outline" label="Menü üst fotoğrafını seç" disabled={!!m.busy} onPress={() => { void m.upload(); }} />{m.menuCover ? <BusinessLink icon="close" label="Menü üst fotoğrafını kaldır" disabled={!!m.busy} onPress={() => { void m.remove(); }} /> : null}
    <Text style={s.heading}>Menü kategorileri</Text><Text style={s.subtle}>Ürün eklerken Grup / Başlık alanından kategorileri oluşturun. Aşağıdan adını ve her kategorinin üst fotoğrafını düzenleyin.</Text>
    <FlatList data={m.groups} scrollEnabled={false} keyExtractor={item => item} contentContainerStyle={s.menuRows} renderItem={({ item: group }) => <View style={s.card}><Text style={s.text}>{group}</Text><TextInput style={s.input} accessibilityLabel={`${group} kategori adı`} value={m.names[group] ?? group} onChangeText={value => m.setName(group, value)} editable={!m.busy} /><BusinessLink label="Kategori adını kaydet" icon="content-save-outline" disabled={!!m.busy} onPress={() => { void m.rename(group); }} />{m.groupCovers[group] ? <Image source={{ uri: m.groupCovers[group] }} style={s.aboutImage} contentFit="cover" transition={200} /> : null}<BusinessLink icon="image-outline" label={`${group} üst fotoğrafını seç`} disabled={!!m.busy} onPress={() => { void m.upload(group); }} />{m.groupCovers[group] ? <BusinessLink icon="close" label="Kategori fotoğrafını kaldır" disabled={!!m.busy} onPress={() => { void m.remove(group); }} /> : null}</View>} ListEmptyComponent={<Text style={s.subtle}>Ürün eklediğinizde kategoriler burada görünür.</Text>} />
    <BusinessError message={m.error} />{m.notice ? <Text style={[s.text, s.gold]} accessibilityLiveRegion="polite">{m.notice}</Text> : null}
  </View>;
});
