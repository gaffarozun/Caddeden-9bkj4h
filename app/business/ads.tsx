// Powered by OnSpace.AI
import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '@/components';
import { AccountRouteBoundary } from '@/components/auth/AccountRouteBoundary';
import { CROP_PRESETS, ImageCropper } from '@/components/feature/ImageCropper';
import { caddeTvCreative, caddeTvCropRatios } from '@/constants/caddeTvTheme';
import { caddeTvDisplayName, caddeTvCreativeError } from '@/services/caddeTvService';
import { CaddeTvCreativePreview } from '@/components/feature/CaddeTvCreativePreview';
import { AdminEmpty, AdminLoading, StatusPill } from '@/components/admin/ui';
import { useAuth } from '@/hooks/useAuth';
import {
  AD_PACKAGE_TYPES,
  AD_TYPE_LABELS,
  AdPackage,
  MyAd,
  MyBusiness,
  applyForAd,
  listActivePackagesByTypes,
  listMyAds,
  listMyBusinesses,
  uploadAdImage,
} from '@/services/adService';
import { useAlert } from '@/template';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
import { useThemeStyles } from '@/hooks/useThemeStyles';

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'primary';

export default function BusinessAdsScreen() { return <AccountRouteBoundary><BusinessAds /></AccountRouteBoundary>; }
function BusinessAds() {
  const { colors, styles } = useThemeStyles(createStyles);
  const router = useRouter();
  const { showAlert } = useAlert();
  const { authUser } = useAuth();

  const [businesses, setBusinesses] = useState<MyBusiness[]>([]);
  const [packages, setPackages] = useState<AdPackage[]>([]);
  const [ads, setAds] = useState<MyAd[]>([]);
  const [bizId, setBizId] = useState('');
  const [pkgId, setPkgId] = useState('');
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState<{ uri: string; base64: string; width: number; height: number } | null>(null);
  const [cropUri, setCropUri] = useState<string | null>(null);
  const [cropVisible, setCropVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!authUser) {
      setLoading(false);
      return;
    }
    const [b, p, a] = await Promise.all([
      listMyBusinesses(authUser.id),
      listActivePackagesByTypes(AD_PACKAGE_TYPES),
      listMyAds(),
    ]);
    setBusinesses(b.data);
    setPackages(p.data);
    setAds(a.data);
    setBizId((prev) => prev || (b.data[0]?.id ?? ''));
    setLoading(false);
  }, [authUser]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const selectedPkg = useMemo(() => packages.find((p) => p.id === pkgId), [packages, pkgId]);
  const isTvAd = selectedPkg?.type === 'reels_sponsored';
  const adRatios = useMemo(() => isTvAd ? caddeTvCropRatios : [CROP_PRESETS['16:9'], CROP_PRESETS['1:1'], CROP_PRESETS['4:5']], [isTvAd]);

  const pickAdImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert('İzin gerekli', 'Görsel seçmek için galeri iznine ihtiyaç var.', [{ text: 'Tamam' }]);
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: false,
    });
    if (!res.canceled && res.assets?.[0]?.uri) {
      setCropUri(res.assets[0].uri);
      setCropVisible(true);
    }
  };

  if (!authUser) {
    return (
      <View style={styles.guard}>
        <MaterialCommunityIcons name="account-lock-outline" size={48} color={colors.textFaint} />
        <Text style={styles.guardText}>Reklam başvurusu için giriş yapmalısın.</Text>
        <Button label="Giriş Yap" icon="login" onPress={() => router.replace('/auth')} />
      </View>
    );
  }

  if (loading) return <AdminLoading />;

  if (businesses.length === 0) {
    return (
      <View style={styles.guard}>
        <MaterialCommunityIcons name="storefront-outline" size={48} color={colors.textFaint} />
        <Text style={styles.guardText}>Reklam vermek için önce bir işletme eklemelisin.</Text>
        <Button label="İşletme Ekle" icon="plus" onPress={() => router.replace('/business/register')} />
      </View>
    );
  }

  const submit = async () => {
    if (!bizId) {
      showAlert('Eksik bilgi', 'İşletme seç.', [{ text: 'Tamam' }]);
      return;
    }
    if (!selectedPkg) {
      showAlert('Eksik bilgi', 'Reklam paketi seç.', [{ text: 'Tamam' }]);
      return;
    }
    if (!isTvAd && !title.trim()) {
      showAlert('Eksik bilgi', 'Reklam metnini yaz.', [{ text: 'Tamam' }]);
      return;
    }
    if (isTvAd) {
      const invalid = caddeTvCreativeError(picked?.width, picked?.height);
      if (invalid) { showAlert('TV görseli gerekli', invalid, [{ text: 'Tamam' }]); return; }
    }
    setSaving(true);
    let imageUrl: string | null = null;
    if (picked) {
      const up = await uploadAdImage(bizId, picked.base64);
      if (up.error) {
        setSaving(false);
        showAlert('Görsel yüklenemedi', up.error, [{ text: 'Tamam' }]);
        return;
      }
      imageUrl = up.url;
    }
    const { error } = await applyForAd({
      business_id: bizId,
      package_id: selectedPkg.id,
      type: selectedPkg.type,
      title: isTvAd ? '' : title.trim(),
      image_url: imageUrl,
      image_width: picked?.width,
      image_height: picked?.height,
    });
    setSaving(false);
    if (error) {
      showAlert('Gönderilemedi', error, [{ text: 'Tamam' }]);
      return;
    }
    setTitle('');
    setPkgId('');
    setPicked(null);
    showAlert('Başvuru gönderildi', 'Reklam başvurun yönetici onayına iletildi. Ödeme onaylanınca yayına alınır.', [{ text: 'Tamam' }]);
    load();
  };

  const adStatus = (a: MyAd): { label: string; tone: Tone } => {
    const map: Record<string, { label: string; tone: Tone }> = {
      active: { label: 'Aktif', tone: 'success' },
      rejected: { label: 'Reddedildi', tone: 'danger' },
      paused: { label: 'Durduruldu', tone: 'neutral' },
      pending: { label: 'Bekliyor', tone: 'warning' },
    };
    return map[a.status] ?? map.pending;
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Yeni Reklam Başvurusu</Text>

          <Text style={styles.label}>İşletme</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {businesses.map((b) => {
              const active = bizId === b.id;
              return (
                <Pressable key={b.id} onPress={() => setBizId(b.id)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && { color: colors.onPrimary }]} numberOfLines={1}>{b.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>Reklam Paketi</Text>
          <View style={{ gap: spacing.sm }}>
            {packages.map((p) => {
              const active = pkgId === p.id;
              return (
                <Pressable key={p.id} onPress={() => { if (p.type !== selectedPkg?.type) setPicked(null); setPkgId(p.id); }} style={[styles.pkgCard, active && styles.pkgCardActive]}>
                  <MaterialCommunityIcons name={active ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={active ? colors.primary : colors.textFaint} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pkgName}>{caddeTvDisplayName(p.name)}</Text>
                    <Text style={styles.pkgMeta}>{AD_TYPE_LABELS[p.type] ?? p.type} · {p.duration_days} gün</Text>
                  </View>
                  <Text style={styles.pkgPrice}>{Number(p.price).toLocaleString('tr-TR')} ₺</Text>
                </Pressable>
              );
            })}
          </View>

          {selectedPkg ? (
            <>
              <Text style={styles.label}>
                {isTvAd ? 'Cadde TV Görseli · Ekran oranı zorunlu' : 'Görsel · 16:9 (opsiyonel)'}
              </Text>
              {isTvAd ? <Text style={styles.pickerText}>Önerilen ölçü: 1584 × 1008 px. Zorunlu TV kırpma çerçevesi; görsel ekrandan taşmaz ve esnetilmez.</Text> : null}
              <Pressable accessibilityRole="button" accessibilityLabel="Reklam görseli seç ve kırp" disabled={saving} style={({ pressed }) => [styles.adPicker, isTvAd ? null : { aspectRatio: 16 / 9 }, pressed ? styles.pressed : null]} onPress={pickAdImage}>
                {isTvAd ? <CaddeTvCreativePreview image={picked?.uri ?? null} /> : picked ? (
                  <Image source={{ uri: picked.uri }} style={styles.adPreview} contentFit="cover" />
                ) : (
                  <View style={styles.adPickerEmpty}>
                    <MaterialCommunityIcons name="image-plus" size={28} color={colors.textFaint} />
                    <Text style={styles.pickerText}>Görsel seç</Text>
                  </View>
                )}
              </Pressable>
              {picked ? (
                <Pressable onPress={() => setPicked(null)} style={styles.removeImg}>
                  <MaterialCommunityIcons name="close-circle-outline" size={16} color={colors.danger} />
                  <Text style={styles.removeImgText}>Görseli kaldır</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {!isTvAd ? <>
            <Text style={styles.label}>Reklam Metni</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Reklamında görünecek kısa metin"
              placeholderTextColor={colors.textFaint}
              style={[styles.input, styles.textArea]}
              multiline
              accessibilityLabel="Reklam metni"
            />
          </> : <Text style={styles.noteText}>Cadde TV reklamında yalnızca fotoğraf yayınlanır; açıklama veya reklam metni eklenmez. İzleyiciler görselden sonraki yayına, işletme adından profiline ulaşır.</Text>}

          <View style={styles.note}>
            <MaterialCommunityIcons name="information-outline" size={16} color={colors.textSubtle} />
            <Text style={styles.noteText}>
              Ücret, yönetici tarafından belirlenen paket fiyatına göre sunucuda hesaplanır. Başvurun, yönetici onayı ve ödeme doğrulandıktan sonra yayına alınır.
            </Text>
          </View>

          <Button label={saving ? 'Gönderiliyor...' : 'Başvuruyu Gönder'} icon="send" onPress={submit} loading={saving} />
        </View>

        <Text style={styles.recentTitle}>Başvurularım</Text>
        {ads.length === 0 ? (
          <AdminEmpty icon="bullhorn-outline" text="Henüz reklam başvurun yok." />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {ads.map((a) => {
              const st = adStatus(a);
              const paid = a.payment_status === 'paid';
              return (
                <View key={a.id} style={styles.adRow}>
                  <View style={styles.adTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.adBiz} numberOfLines={1}>{a.businesses?.name ?? 'İşletme'}</Text>
                      <Text style={styles.adType}>{AD_TYPE_LABELS[a.type] ?? a.type}</Text>
                    </View>
                    <StatusPill label={st.label} tone={st.tone} />
                  </View>
                  {a.type !== 'reels_sponsored' && a.title ? <Text style={styles.adTitle} numberOfLines={2}>{a.title}</Text> : null}
                  {a.image_url ? (
                    <Image
                      source={{ uri: a.image_url }}
                      style={[styles.adImage, { aspectRatio: a.type === 'reels_sponsored' ? caddeTvCreative.value : 16 / 9 }]}
                      contentFit="contain"
                      transition={150}
                    />
                  ) : null}
                  <View style={styles.adBottom}>
                    <Text style={styles.adPrice}>{Number(a.price).toLocaleString('tr-TR')} ₺</Text>
                    <StatusPill label={paid ? 'Ödendi' : 'Ödeme bekliyor'} tone={paid ? 'success' : 'warning'} />
                  </View>
                  {a.status === 'rejected' && a.rejection_reason ? (
                    <Text style={styles.reason}>Ret nedeni: {a.rejection_reason}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <ImageCropper
        visible={cropVisible}
        uri={cropUri}
        ratios={adRatios}
        initialRatioId={adRatios[0].id}
        onCancel={() => setCropVisible(false)}
        onDone={(r) => {
          setPicked({ uri: r.uri, base64: r.base64, width: r.width, height: r.height });
          setCropVisible(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  guard: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.background },
  guardText: { fontSize: fontSize.md, color: colors.textSubtle, textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  cardTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.xs },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.text, marginTop: spacing.sm },
  chipsRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, maxWidth: 200 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.medium },
  pkgCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  pkgCardActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  pkgName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  pkgMeta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
  pkgPrice: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primary },
  input: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: fontSize.md, color: colors.text },
  textArea: { height: 80, textAlignVertical: 'top' },
  note: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginVertical: spacing.sm },
  noteText: { flex: 1, fontSize: fontSize.xs, color: colors.textSubtle, lineHeight: fontSize.xs * 1.5 },
  recentTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  adRow: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  adTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  adBiz: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  adType: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
  adTitle: { fontSize: fontSize.sm, color: colors.text },
  adBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  adPrice: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primary },
  reason: { fontSize: fontSize.xs, color: colors.danger },
  pressed: { opacity: 0.75 },
  adPicker: { width: '100%', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  adPickerEmpty: { alignItems: 'center', gap: 6, padding: spacing.md },
  adPreview: { width: '100%', height: '100%' },
  pickerText: { fontSize: fontSize.sm, color: colors.textSubtle, fontWeight: fontWeight.medium },
  removeImg: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  removeImgText: { fontSize: fontSize.sm, color: colors.danger, fontWeight: fontWeight.medium },
  adImage: { width: '100%', borderRadius: radius.md, backgroundColor: colors.surfaceTint, marginTop: spacing.xs },
});
