// Powered by OnSpace.AI
// Cadde TV photo-only publishing and captioned regular posts for businesses.
// - Photos are cropped with the interactive ImageCropper (free / 1:1 / 9:16 /
//   16:9 / 4:5) — pinch to zoom, drag to position, live frame preview. The chosen
//   crop is applied exactly once; no silent re-cropping on submit.
// - Each share picks an admin-priced plan (duration). Everything goes to the admin
//   for approval; nothing is published until the admin approves it.
import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '@/components';
import { AccountRouteBoundary } from '@/components/auth/AccountRouteBoundary';
import { CROP_PRESETS, ImageCropper } from '@/components/feature/ImageCropper';
import { caddeTvCropRatios } from '@/constants/caddeTvTheme';
import { caddeTvDisplayName } from '@/services/caddeTvService';
import { CaddeTvCreativePreview } from '@/components/feature/CaddeTvCreativePreview';
import { AdminEmpty, AdminLoading, StatusPill } from '@/components/admin/ui';
import { useAuth } from '@/hooks/useAuth';
import { AdPackage, MyBusiness, listActivePackagesByTypes, listMyBusinesses } from '@/services/adService';
import { ContentKind, FeedItem, createContent, deleteContent, listMyContent, timeAgo } from '@/services/contentService';
import { useAlert } from '@/template';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
import { useThemeStyles } from '@/hooks/useThemeStyles';

interface PickedImage {
  uri: string;
  base64: string;
  width: number;
  height: number;
}

function contentStatusMeta(status?: string): { label: string; tone: 'success' | 'warning' | 'danger' } {
  if (status === 'approved') return { label: 'Yayında', tone: 'success' };
  if (status === 'rejected') return { label: 'Reddedildi', tone: 'danger' };
  return { label: 'Onay bekliyor', tone: 'warning' };
}

export default function BusinessPostsScreen() { return <AccountRouteBoundary><BusinessPosts /></AccountRouteBoundary>; }
function BusinessPosts() {
  const { colors, styles } = useThemeStyles(createStyles);
  const router = useRouter();
  const { showAlert } = useAlert();
  const { authUser } = useAuth();

  const [businesses, setBusinesses] = useState<MyBusiness[]>([]);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [packages, setPackages] = useState<AdPackage[]>([]);
  const [bizId, setBizId] = useState('');
  const [kind, setKind] = useState<ContentKind>('post');
  const [planId, setPlanId] = useState('');
  const [caption, setCaption] = useState('');
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [cropUri, setCropUri] = useState<string | null>(null);
  const [cropVisible, setCropVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!authUser) {
      setLoading(false);
      return;
    }
    const [b, c, p] = await Promise.all([
      listMyBusinesses(authUser.id),
      listMyContent(authUser.id),
      listActivePackagesByTypes(['content_reel', 'content_post']),
    ]);
    setBusinesses(b.data);
    setItems(c.data);
    setPackages(p.data);
    setBizId((prev) => prev || (b.data[0]?.id ?? ''));
    setLoading(false);
  }, [authUser]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const kindPlans = useMemo(
    () => packages.filter((p) => p.type === (kind === 'reel' ? 'content_reel' : 'content_post')),
    [packages, kind]
  );
  const selectedPlan = useMemo(() => kindPlans.find((p) => p.id === planId), [kindPlans, planId]);

  const cropRatios = useMemo(() => kind === 'reel'
    ? caddeTvCropRatios
    : [CROP_PRESETS['4:5'], CROP_PRESETS['1:1'], CROP_PRESETS['9:16'], CROP_PRESETS['16:9'], CROP_PRESETS.free], [kind]);

  if (!authUser) {
    return (
      <View style={styles.guard}>
        <MaterialCommunityIcons name="account-lock-outline" size={48} color={colors.textFaint} />
        <Text style={styles.guardText}>Paylaşım eklemek için giriş yapmalısın.</Text>
        <Button label="Giriş Yap" icon="login" onPress={() => router.replace('/auth')} />
      </View>
    );
  }

  if (loading) return <AdminLoading />;

  if (businesses.length === 0) {
    return (
      <View style={styles.guard}>
        <MaterialCommunityIcons name="storefront-outline" size={48} color={colors.textFaint} />
        <Text style={styles.guardText}>Paylaşım yapmak için önce bir işletme eklemelisin.</Text>
        <Button label="İşletme Ekle" icon="plus" onPress={() => router.replace('/business/register')} />
      </View>
    );
  }

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert('İzin gerekli', 'Fotoğraf seçmek için galeri iznine ihtiyaç var.', [{ text: 'Tamam' }]);
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

  const submit = async () => {
    if (!bizId) {
      showAlert('Eksik bilgi', 'İşletme seç.', [{ text: 'Tamam' }]);
      return;
    }
    if (!picked) {
      showAlert('Eksik bilgi', 'Bir fotoğraf seç ve kırp.', [{ text: 'Tamam' }]);
      return;
    }
    if (kind === 'post' && !caption.trim()) {
      showAlert('Eksik bilgi', 'Açıklama yaz.', [{ text: 'Tamam' }]);
      return;
    }
    if (kindPlans.length > 0 && !selectedPlan) {
      showAlert('Plan seç', 'Paylaşım süresi ve ücretini seç.', [{ text: 'Tamam' }]);
      return;
    }
    setSaving(true);
    const { error } = await createContent({
      business_id: bizId,
      kind,
      caption: kind === 'reel' ? '' : caption.trim(),
      base64: picked.base64,
      image_width: picked.width,
      image_height: picked.height,
      package_id: selectedPlan?.id ?? null,
      price: selectedPlan?.price ?? 0,
    });
    setSaving(false);
    if (error) {
      showAlert('Paylaşılamadı', error, [{ text: 'Tamam' }]);
      return;
    }
    setCaption('');
    setPicked(null);
    setPlanId('');
    showAlert('Gönderildi', 'Paylaşımın yönetici onayına iletildi. Onaylandıktan sonra herkese görünür olur.', [{ text: 'Tamam' }]);
    load();
  };

  const confirmDelete = (id: string) =>
    showAlert('Paylaşımı sil', 'Bu paylaşım silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const { error } = await deleteContent(id);
          if (error) showAlert('Silinemedi', error, [{ text: 'Tamam' }]);
          else load();
        },
      },
    ]);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Yeni Paylaşım</Text>

          <Text style={styles.label}>Tür</Text>
          <View style={styles.kindRow}>
            <KindBtn label="Gönderi" icon="image-outline" active={kind === 'post'} onPress={() => { setKind('post'); setPlanId(''); setPicked(null); }} />
            <KindBtn label="Cadde TV" icon="television-classic" active={kind === 'reel'} onPress={() => { setKind('reel'); setPlanId(''); setPicked(null); }} />
          </View>

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

          <Text style={styles.label}>{kind === 'reel' ? 'Cadde TV görseli · Ekran oranı zorunlu' : 'Fotoğraf'}</Text>
          {kind === 'reel' ? <Text style={styles.pickerText}>Önerilen ölçü: 1584 × 1008 px. Görseli TV çerçevesinde konumlandır; ekrana taşmadan ve esnetilmeden yerleşir.</Text> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Görsel seç ve kırp" disabled={saving} style={({ pressed }) => [styles.picker, kind === 'reel' ? styles.tvPicker : null, pressed ? styles.pressed : null]} onPress={pickImage}>
            {kind === 'reel' ? <CaddeTvCreativePreview image={picked?.uri ?? null} /> : picked ? (
              <Image source={{ uri: picked.uri }} style={styles.preview} contentFit="cover" />
            ) : (
              <View style={styles.pickerEmpty}>
                <MaterialCommunityIcons name="image-plus" size={32} color={colors.textFaint} />
                <Text style={styles.pickerText}>Galeriden fotoğraf seç ve kırp</Text>
                <Text style={styles.pickerHint}>Yakınlaştır, kaydır, oranı seç · sadece fotoğraf</Text>
              </View>
            )}
          </Pressable>
          {picked ? (
            <Pressable onPress={pickImage} style={styles.changeBtn}>
              <MaterialCommunityIcons name="crop-rotate" size={16} color={colors.primary} />
              <Text style={styles.changeText}>Fotoğrafı değiştir / yeniden kırp</Text>
            </Pressable>
          ) : null}

          {kindPlans.length > 0 ? (
            <>
              <Text style={styles.label}>{kind === 'reel' ? 'Cadde TV Planı' : 'Gönderi Planı'} (yönetici fiyatı)</Text>
              <View style={{ gap: spacing.sm }}>
                {kindPlans.map((p) => {
                  const active = planId === p.id;
                  return (
                    <Pressable key={p.id} onPress={() => setPlanId(p.id)} style={[styles.planCard, active && styles.planCardActive]}>
                      <MaterialCommunityIcons name={active ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={active ? colors.primary : colors.textFaint} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.planName}>{caddeTvDisplayName(p.name)}</Text>
                        <Text style={styles.planMeta}>{p.duration_days} gün yayında kalır</Text>
                      </View>
                      <Text style={styles.planPrice}>{Number(p.price).toLocaleString('tr-TR')} ₺</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {kind === 'post' ? <>
            <Text style={styles.label}>Açıklama</Text>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Kampanya, duyuru veya kısa açıklama"
              placeholderTextColor={colors.textFaint}
              style={[styles.input, styles.textArea]}
              multiline
              accessibilityLabel="Açıklama"
            />
          </> : <Text style={styles.noteText}>Cadde TV yalnızca fotoğraf yayınlar; açıklama eklenmez. Görselin otomatik yayın akışında gösterilir ve işletme profiline bağlanır.</Text>}

          <View style={styles.note}>
            <MaterialCommunityIcons name="shield-check-outline" size={16} color={colors.textSubtle} />
            <Text style={styles.noteText}>
              Paylaşımın yönetici onayından geçer. Seçtiğin plan ücretlendirilir ve yönetici onaylamadan içerik yayınlanmaz.
            </Text>
          </View>

          <Button label={saving ? 'Gönderiliyor...' : 'Onaya Gönder'} icon="send" onPress={submit} loading={saving} />
        </View>

        <Text style={styles.recentTitle}>Paylaşımlarım</Text>
        {items.length === 0 ? (
          <AdminEmpty icon="image-multiple-outline" text="Henüz paylaşımın yok." />
        ) : (
          <View style={{ gap: spacing.md }}>
            {items.map((it) => (
              <View key={it.id} style={styles.itemRow}>
                <Image source={{ uri: it.image_url }} style={styles.itemImg} contentFit="cover" transition={150} />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.itemTop}>
                    <StatusPill label={it.kind === 'reel' ? 'Cadde TV' : 'Gönderi'} tone={it.kind === 'reel' ? 'primary' : 'info'} />
                    <StatusPill label={contentStatusMeta(it.status).label} tone={contentStatusMeta(it.status).tone} />
                    <Text style={styles.itemTime}>{timeAgo(it.created_at)}</Text>
                  </View>
                  <Text style={styles.itemCaption} numberOfLines={2}>{it.kind === 'reel' ? it.businesses?.name ?? 'Cadde TV görseli' : it.caption}</Text>
                  {it.status === 'rejected' && it.rejection_reason ? (
                    <Text style={styles.rejected}>Ret: {it.rejection_reason}</Text>
                  ) : null}
                </View>
                <Pressable hitSlop={8} onPress={() => confirmDelete(it.id)} style={styles.deleteBtn}>
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <ImageCropper
        visible={cropVisible}
        uri={cropUri}
        ratios={cropRatios}
        initialRatioId={cropRatios[0].id}
        onCancel={() => setCropVisible(false)}
        onDone={(r) => {
          setPicked({ uri: r.uri, base64: r.base64, width: r.width, height: r.height });
          setCropVisible(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function KindBtn({ label, icon, active, onPress }: { label: string; icon: string; active: boolean; onPress: () => void }) {
  const { colors, styles } = useThemeStyles(createStyles);
  return (
    <Pressable onPress={onPress} style={[styles.kindBtn, active && styles.kindBtnActive]}>
      <MaterialCommunityIcons name={icon as keyof typeof MaterialCommunityIcons.glyphMap} size={18} color={active ? colors.onPrimary : colors.textSubtle} />
      <Text style={[styles.kindText, active && { color: colors.onPrimary }]}>{label}</Text>
    </Pressable>
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
  kindRow: { flexDirection: 'row', gap: spacing.sm },
  kindBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  kindBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  kindText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSubtle },
  chipsRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, maxWidth: 220 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.medium },
  picker: { height: 200, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pickerEmpty: { alignItems: 'center', gap: 6 },
  pickerText: { fontSize: fontSize.sm, color: colors.textSubtle, fontWeight: fontWeight.medium },
  pickerHint: { fontSize: fontSize.xs, color: colors.textFaint },
  preview: { width: '100%', height: '100%' },
  tvPicker: { height: undefined, minHeight: 1, backgroundColor: colors.black },
  pressed: { opacity: 0.75 },
  changeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  changeText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.medium },
  planCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  planCardActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  planName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  planMeta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
  planPrice: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primary },
  input: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: fontSize.md, color: colors.text },
  textArea: { height: 90, textAlignVertical: 'top' },
  note: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginVertical: spacing.sm },
  noteText: { flex: 1, fontSize: fontSize.xs, color: colors.textSubtle, lineHeight: fontSize.xs * 1.5 },
  recentTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  itemImg: { width: 60, height: 60, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  itemTime: { fontSize: fontSize.xs, color: colors.textFaint },
  itemCaption: { fontSize: fontSize.sm, color: colors.text },
  rejected: { fontSize: fontSize.xs, color: colors.danger },
  deleteBtn: { padding: spacing.sm },
});
