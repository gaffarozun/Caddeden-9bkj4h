// Powered by OnSpace.AI
// "İşletme Sayfam": owner-only business management. Edit profile, media, location
// and price list. All writes are RLS-scoped to the owner; protected columns
// (approval/publish/featured/rating) are enforced server-side.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { saveBusinessCurrentLocation } from '@/services/businessLocationService';
import { Button } from '@/components';
import { AccountRouteBoundary } from '@/components/auth/AccountRouteBoundary';
import { StatusPill } from '@/components/admin/ui';
import { ExperienceAccessCard } from '@/components/feature/ExperienceAccessCard';
import { BusinessAppearanceEditor } from '@/components/feature/BusinessAppearanceEditor';
import { CafeRoomSetting } from '@/components/feature/CafeRoomSetting';
import { CafeSeatingEditor } from '@/components/feature/CafeSeatingEditor';
import { useAuth } from '@/hooks/useAuth';
import {
  MenuItemRow,
  OwnedBusinessFull,
  addMenuItem,
  deleteMenuItem,
  fetchOwnedBusiness,
  listMenuItems,
  updateBusinessProfile,
  updateMenuItem,
  uploadBusinessMedia,
} from '@/services/businessManageService';
import { MAIN_CATEGORIES, MainCategoryId, getSubCategory, subCategoriesOf } from '@/services/categories';
import { WEEKDAYS, getOpenStatus } from '@/services/businessStatus';
import { Business } from '@/services/types';
import { useAlert } from '@/template';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
import { useThemeStyles } from '@/hooks/useThemeStyles';

type Tone = 'success' | 'warning' | 'danger';

export default function BusinessManageScreen() { return <AccountRouteBoundary><BusinessManage /></AccountRouteBoundary>; }
function BusinessManage() {
  const { colors, styles } = useThemeStyles(createStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { authUser } = useAuth();
  const userId = authUser?.id;
  const accountRole = authUser?.role;
  const businessAccess = authUser?.businessAccess;

  const [business, setBusiness] = useState<OwnedBusinessFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [hours, setHours] = useState('');
  const [main, setMain] = useState<MainCategoryId>('yeme_icme');
  const [sub, setSub] = useState('restoran');
  const [isOpen, setIsOpen] = useState(true);
  const [statusMode, setStatusMode] = useState<'auto' | 'manual'>('manual');
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [openDays, setOpenDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [avgDelivery, setAvgDelivery] = useState('');
  const [allowMenu, setAllowMenu] = useState(true);
  const [allowReservation, setAllowReservation] = useState(true);
  const [allowOrder, setAllowOrder] = useState(false);
  const [minOrder, setMinOrder] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [locating, setLocating] = useState(false);

  const [menu, setMenu] = useState<MenuItemRow[]>([]);
  const [miName, setMiName] = useState('');
  const [miDescription, setMiDescription] = useState('');
  const [miPrice, setMiPrice] = useState('');
  const [miGroup, setMiGroup] = useState('');
  const [miDuration, setMiDuration] = useState('');
  const [miImage, setMiImage] = useState<{ uri: string; base64: string } | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [itemImageBusy, setItemImageBusy] = useState<string | null>(null);

  const subs = useMemo(() => subCategoriesOf(main), [main]);
  const subMeta = getSubCategory(sub);
  const hasOrder = !!subMeta?.hasOrder;
  const isService = !!subMeta?.hasAppointment;

  const applyBusiness = useCallback((b: OwnedBusinessFull) => {
    setBusiness(b);
    setName(b.name ?? '');
    setDescription(b.description ?? '');
    setPhone(b.phone ?? '');
    setEmail(b.email ?? '');
    setAddress(b.address ?? '');
    setHours(b.hours ?? '');
    setMain((b.main_category as MainCategoryId) ?? 'yeme_icme');
    setSub(getSubCategory(b.category)?.id ?? 'restoran');
    setIsOpen(b.is_open);
    setStatusMode(b.status_mode === 'auto' ? 'auto' : 'manual');
    setOpenTime(b.open_time ?? '');
    setCloseTime(b.close_time ?? '');
    setOpenDays(b.open_days && b.open_days.length ? b.open_days : [0, 1, 2, 3, 4, 5, 6]);
    setAvgDelivery(b.avg_delivery_minutes != null ? String(b.avg_delivery_minutes) : '');
    setAllowMenu(b.allow_menu);
    setAllowReservation(b.allow_reservation);
    setAllowOrder(b.allow_order);
    setMinOrder(b.min_order ? String(b.min_order) : '');
    setLat(b.lat);
    setLng(b.lng);
    setLogoUrl(b.logo_url);
    setCoverUrl(b.cover_url);
    setImages(b.images ?? []);
  }, []);

  const loadMenu = useCallback(async (bid: string) => {
    const { data } = await listMenuItems(bid);
    setMenu(data);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!userId || !id) {
        setLoading(false);
        return;
      }
      const { data, error } = await fetchOwnedBusiness(id, userId);
      if (!active) return;
      if (error) showAlert('İşletme yüklenemedi', error);
      if (data) {
        applyBusiness(data);
        await loadMenu(id);
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId, accountRole, businessAccess, id, applyBusiness, loadMenu, showAlert]);

  if (!authUser) {
    return (
      <View style={styles.guard}>
        <MaterialCommunityIcons name="account-lock-outline" size={48} color={colors.textFaint} />
        <Text style={styles.guardText}>İşletme sayfanı yönetmek için giriş yapmalısın.</Text>
        <Button label="Giriş Yap" icon="login" onPress={() => router.replace('/auth')} />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.guard}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={styles.guard}>
        <MaterialCommunityIcons name="storefront-remove-outline" size={48} color={colors.textFaint} />
        <Text style={styles.guardText}>Bu işletme bulunamadı veya sana ait değil.</Text>
        <Button label="Geri Dön" icon="arrow-left" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const bizId = business.id;
  const previewStatus = getOpenStatus({
    isOpen,
    openTime: openTime || undefined,
    closeTime: closeTime || undefined,
    openDays,
    statusMode,
    hours,
  } as unknown as Business);

  const pickImage = async (aspect: [number, number]) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert('İzin gerekli', 'Fotoğraf seçmek için galeri iznine ihtiyaç var.', [{ text: 'Tamam' }]);
      return null;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
      allowsEditing: true,
      aspect,
    });
    if (!res.canceled && res.assets?.[0]?.base64) {
      return { uri: res.assets[0].uri, base64: res.assets[0].base64 };
    }
    return null;
  };

  const changeLogo = async () => {
    const img = await pickImage([1, 1]);
    if (!img) return;
    setUploadingLogo(true);
    const { url, error } = await uploadBusinessMedia(bizId, img.base64, 'logo');
    if (url) {
      await updateBusinessProfile(bizId, { logo_url: url });
      setLogoUrl(url);
    } else {
      showAlert('Yüklenemedi', error ?? 'Logo yüklenemedi.', [{ text: 'Tamam' }]);
    }
    setUploadingLogo(false);
  };

  const changeCover = async () => {
    const img = await pickImage([16, 9]);
    if (!img) return;
    setUploadingCover(true);
    const { url, error } = await uploadBusinessMedia(bizId, img.base64, 'cover');
    if (url) {
      await updateBusinessProfile(bizId, { cover_url: url });
      setCoverUrl(url);
    } else {
      showAlert('Yüklenemedi', error ?? 'Kapak yüklenemedi.', [{ text: 'Tamam' }]);
    }
    setUploadingCover(false);
  };

  const addGalleryImage = async () => {
    const img = await pickImage([4, 3]);
    if (!img) return;
    setUploadingGallery(true);
    const { url, error } = await uploadBusinessMedia(bizId, img.base64, 'gallery');
    if (url) {
      const next = [...images, url];
      setImages(next);
      await updateBusinessProfile(bizId, { images: next });
    } else {
      showAlert('Yüklenemedi', error ?? 'Fotoğraf yüklenemedi.', [{ text: 'Tamam' }]);
    }
    setUploadingGallery(false);
  };

  const removeGalleryImage = (url: string) => {
    const next = images.filter((u) => u !== url);
    setImages(next);
    updateBusinessProfile(bizId, { images: next });
  };

  const toggleOpen = async (v: boolean) => {
    setIsOpen(v);
    await updateBusinessProfile(bizId, { is_open: v });
  };

  const useMyLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const position = await saveBusinessCurrentLocation(bizId);
      setLat(position.latitude);
      setLng(position.longitude);
      showAlert('Konum kaydedildi', 'İşletme konumu kaydedildi. 50 metre içindeki müşteriler katılımını doğrulayabilir.', [{ text: 'Tamam' }]);
    } catch (reason) {
      showAlert('Konum kaydedilemedi', reason instanceof Error ? reason.message : 'İşletmedeyken hassas konumu açıp yeniden deneyin.', [{ text: 'Tamam' }]);
    } finally { setLocating(false); }
  };

  const openOnMap = () => {
    const q = lat != null && lng != null ? `${lat},${lng}` : encodeURIComponent(address || name);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(() =>
      showAlert('Harita açılamadı', 'Cihazında harita uygulaması bulunamadı.', [{ text: 'Tamam' }])
    );
  };

  const save = async () => {
    if (!name.trim()) {
      showAlert('Eksik bilgi', 'İşletme adını gir.', [{ text: 'Tamam' }]);
      return;
    }
    setSaving(true);
    const composedHours =
      openTime.trim() && closeTime.trim() ? `${openTime.trim()} - ${closeTime.trim()}` : hours.trim() || null;
    const { error } = await updateBusinessProfile(bizId, {
      name: name.trim(),
      description: description.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      hours: composedHours,
      status_mode: statusMode,
      open_time: openTime.trim() || null,
      close_time: closeTime.trim() || null,
      open_days: openDays,
      avg_delivery_minutes:
        hasOrder && allowOrder && avgDelivery.trim() && Number.isFinite(Number(avgDelivery)) ? Number(avgDelivery) : null,
      allow_menu: allowMenu,
      allow_reservation: allowReservation,
      allow_order: hasOrder ? allowOrder : false,
      min_order:
        hasOrder && allowOrder && minOrder.trim() && Number.isFinite(Number(minOrder.replace(',', '.')))
          ? Number(minOrder.replace(',', '.'))
          : 0,
      main_category: main,
      category: sub,
    });
    setSaving(false);
    if (error) {
      showAlert('Kaydedilemedi', error, [{ text: 'Tamam' }]);
      return;
    }
    showAlert('Kaydedildi', 'İşletme bilgilerin güncellendi.', [{ text: 'Tamam' }]);
  };

  const pickItemImage = async () => {
    const img = await pickImage([4, 3]);
    if (img) setMiImage({ uri: img.uri, base64: img.base64 });
  };

  const setExistingItemImage = async (itemId: string) => {
    const img = await pickImage([4, 3]);
    if (!img) return;
    setItemImageBusy(itemId);
    const { url, error } = await uploadBusinessMedia(bizId, img.base64, 'menu');
    if (url) {
      const { error: upErr } = await updateMenuItem(itemId, { image_url: url });
      if (upErr) showAlert('Güncellenemedi', upErr, [{ text: 'Tamam' }]);
      else await loadMenu(bizId);
    } else {
      showAlert('Yüklenemedi', error ?? 'Fotoğraf yüklenemedi.', [{ text: 'Tamam' }]);
    }
    setItemImageBusy(null);
  };

  const submitMenuItem = async () => {
    if (!miName.trim()) {
      showAlert('Eksik bilgi', isService ? 'Hizmet adını gir.' : 'Ürün adını gir.', [{ text: 'Tamam' }]);
      return;
    }
    const priceNum = Number(miPrice.replace(',', '.'));
    setAddingItem(true);
    let imageUrl: string | null = null;
    if (miImage) {
      const { url, error: upErr } = await uploadBusinessMedia(bizId, miImage.base64, 'menu');
      if (upErr) {
        setAddingItem(false);
        showAlert('Yüklenemedi', upErr, [{ text: 'Tamam' }]);
        return;
      }
      imageUrl = url;
    }
    const { error } = await addMenuItem({
      business_id: bizId,
      name: miName.trim(),
      description: miDescription.trim() || null,
      price: Number.isFinite(priceNum) ? priceNum : 0,
      group_name: miGroup.trim() || null,
      item_type: isService ? 'service' : 'product',
      duration_min: isService && miDuration ? Number(miDuration) : null,
      image_url: imageUrl,
      sort_order: menu.length,
    });
    setAddingItem(false);
    if (error) {
      showAlert('Eklenemedi', error, [{ text: 'Tamam' }]);
      return;
    }
    setMiName('');
    setMiDescription('');
    setMiPrice('');
    setMiGroup('');
    setMiDuration('');
    setMiImage(null);
    await loadMenu(bizId);
  };

  const removeMenuItem = (itemId: string) =>
    showAlert('Sil', 'Bu kalem silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const { error } = await deleteMenuItem(itemId);
          if (error) showAlert('Silinemedi', error, [{ text: 'Tamam' }]);
          else loadMenu(bizId);
        },
      },
    ]);

  const approved = business.approval_status === 'approved';
  const rejected = business.approval_status === 'rejected';
  const statusTone: Tone = approved ? 'success' : rejected ? 'danger' : 'warning';
  const statusLabel = approved ? (business.is_published ? 'Yayında' : 'Onaylı') : rejected ? 'Reddedildi' : 'Onay bekliyor';
  const statusNote = approved
    ? 'Sayfan kullanıcılara açık. Yaptığın değişiklikler anında yansır.'
    : rejected
    ? business.rejection_reason
      ? `Ret nedeni: ${business.rejection_reason}`
      : 'Başvurun reddedildi. Bilgileri güncelleyip tekrar değerlendirme isteyebilirsin.'
    : 'Onay bekliyor. Sayfanı burada düzenleyebilirsin; onaylandığında otomatik yayınlanır.';

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable style={styles.cover} onPress={changeCover}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          ) : (
            <View style={styles.coverEmpty}>
              <MaterialCommunityIcons name="image-plus" size={28} color={colors.textFaint} />
              <Text style={styles.coverText}>Kapak fotoğrafı ekle</Text>
            </View>
          )}
          <View style={styles.coverEditBadge}>
            {uploadingCover ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <MaterialCommunityIcons name="camera-outline" size={16} color={colors.white} />
            )}
          </View>
        </Pressable>

        <View style={styles.logoRow}>
          <Pressable style={styles.logo} onPress={changeLogo}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.logoImg} contentFit="cover" />
            ) : (
              <MaterialCommunityIcons name="storefront-outline" size={26} color={colors.primary} />
            )}
            <View style={styles.logoEditBadge}>
              {uploadingLogo ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <MaterialCommunityIcons name="camera-outline" size={12} color={colors.white} />
              )}
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.bizName} numberOfLines={1}>{name || 'İşletmem'}</Text>
            <StatusPill label={statusLabel} tone={statusTone} />
          </View>
        </View>

        <View style={[styles.noteBox, rejected && styles.noteBoxDanger]}>
          <MaterialCommunityIcons
            name={approved ? 'check-decagram-outline' : rejected ? 'alert-circle-outline' : 'clock-outline'}
            size={16}
            color={approved ? colors.success : rejected ? colors.danger : colors.warning}
          />
          <Text style={styles.noteText}>{statusNote}</Text>
        </View>

        <Button label="İşletme Sayfamı Önizle" icon="eye-outline" variant="secondary" onPress={() => router.push(`/business/${bizId}`)} />
        <ExperienceAccessCard businessId={bizId} />
        <CafeRoomSetting businessId={bizId} />
        <CafeSeatingEditor businessId={bizId} />
        <BusinessAppearanceEditor businessId={bizId} menuVersion={menu.map(item => `${item.id}:${item.group_name}`).join('|')} />

        <Text style={styles.sectionTitle}>Durum & Çalışma Saatleri</Text>
        <View style={styles.card}>
          <View style={styles.modeRow}>
            {(['auto', 'manual'] as const).map((m) => {
              const active = statusMode === m;
              return (
                <Pressable key={m} onPress={() => setStatusMode(m)} style={[styles.modeBtn, active && styles.modeBtnActive]}>
                  <MaterialCommunityIcons
                    name={m === 'auto' ? 'clock-outline' : 'toggle-switch-outline'}
                    size={16}
                    color={active ? colors.onPrimary : colors.textSubtle}
                  />
                  <Text style={[styles.modeText, active && { color: colors.onPrimary }]}>{m === 'auto' ? 'Otomatik' : 'Manuel'}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.helperText}>
            {statusMode === 'auto'
              ? 'Açık/kapalı durumu, açılış-kapanış saatleri ve açık günlere göre otomatik belirlenir.'
              : 'Açık/kapalı durumunu kendin belirlersin. Saat dışı durumlar kullanıcılara ayrıca gösterilir.'}
          </Text>

          <View style={styles.inlineRow}>
            <View style={{ flex: 1 }}>
              <Field label="Açılış" value={openTime} onChangeText={setOpenTime} placeholder="09:00" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Kapanış" value={closeTime} onChangeText={setCloseTime} placeholder="22:00" />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Açık Günler</Text>
          <View style={styles.daysRow}>
            {WEEKDAYS.map((d) => {
              const active = openDays.includes(d.value);
              return (
                <Pressable
                  key={d.value}
                  onPress={() =>
                    setOpenDays((prev) => (prev.includes(d.value) ? prev.filter((x) => x !== d.value) : [...prev, d.value]))
                  }
                  style={[styles.dayChip, active && styles.dayChipActive]}
                >
                  <Text style={[styles.dayText, active && { color: colors.onPrimary }]}>{d.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {statusMode === 'manual' ? (
            <View style={styles.openRow}>
              <View style={styles.settingLeft}>
                <MaterialCommunityIcons name={isOpen ? 'door-open' : 'door-closed'} size={20} color={isOpen ? colors.success : colors.textSubtle} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.openTitle}>{isOpen ? 'Şu an açık' : 'Şu an kapalı'}</Text>
                  <Text style={styles.openSub}>Manuel açık/kapalı anahtarı</Text>
                </View>
              </View>
              <Switch value={isOpen} onValueChange={toggleOpen} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.white} />
            </View>
          ) : null}

          <View style={[styles.previewRow, previewStatus.open ? styles.previewOpen : styles.previewClosed]}>
            <MaterialCommunityIcons
              name={previewStatus.open ? 'check-circle-outline' : 'close-circle-outline'}
              size={16}
              color={previewStatus.open ? colors.success : colors.danger}
            />
            <Text style={styles.previewText}>
              Şu an: {previewStatus.label}
              {previewStatus.detail ? ` · ${previewStatus.detail}` : ''}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Temel Bilgiler</Text>
        <View style={styles.card}>
          <Field label="İşletme Adı" value={name} onChangeText={setName} placeholder="Örn. Köşe Ocakbaşı" />
          <Field label="Açıklama" value={description} onChangeText={setDescription} placeholder="Kısa tanıtım" multiline />
          <Field label="Telefon" value={phone} onChangeText={setPhone} placeholder="+90 5xx xxx xx xx" keyboardType="phone-pad" />
          <Field label="İşletme E-postası" value={email} onChangeText={setEmail} placeholder="iletisim@isletme.com" keyboardType="email-address" />
        </View>

        <Text style={styles.sectionTitle}>Sunduğun Hizmetler</Text>
        <View style={styles.card}>
          <View style={styles.openRow}>
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="format-list-bulleted" size={20} color={allowMenu ? colors.primary : colors.textSubtle} />
              <View style={{ flex: 1 }}>
                <Text style={styles.openTitle}>Fiyat listesi sun</Text>
                <Text style={styles.openSub}>Menü / hizmet fiyatlarını müşterilere göster</Text>
              </View>
            </View>
            <Switch
              value={allowMenu}
              onValueChange={(v) => { setAllowMenu(v); updateBusinessProfile(bizId, { allow_menu: v }); }}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.white}
            />
          </View>
          {hasOrder ? (
            <>
              <View style={styles.openRow}>
                <View style={styles.settingLeft}>
                  <MaterialCommunityIcons name="cart-outline" size={20} color={allowOrder ? colors.primary : colors.textSubtle} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.openTitle}>Sipariş al</Text>
                    <Text style={styles.openSub}>Müşteriler menüden ürün seçip sepetle sipariş gönderebilsin</Text>
                  </View>
                </View>
                <Switch
                  value={allowOrder}
                  onValueChange={(v) => { setAllowOrder(v); updateBusinessProfile(bizId, { allow_order: v }); }}
                  trackColor={{ true: colors.primary, false: colors.border }}
                  thumbColor={colors.white}
                />
              </View>
              {allowOrder ? (
                <View style={styles.orderSettings}>
                  <Field label="Minimum Sipariş Tutarı (₺)" value={minOrder} onChangeText={setMinOrder} placeholder="Örn. 250" keyboardType="numeric" />
                  <Text style={styles.helperText}>Müşterinin sepet tutarı bu değere ulaşmadan sipariş gönderilemez. 0 bırakırsan alt sınır olmaz.</Text>
                  <Field label="Ortalama Teslim Süresi (dk)" value={avgDelivery} onChangeText={setAvgDelivery} placeholder="Örn. 30" keyboardType="numeric" />
                </View>
              ) : null}
            </>
          ) : null}
          <View style={styles.openRow}>
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="calendar-check-outline" size={20} color={allowReservation ? colors.primary : colors.textSubtle} />
              <View style={{ flex: 1 }}>
                <Text style={styles.openTitle}>Rezervasyon / randevu al</Text>
                <Text style={styles.openSub}>Müşteriler senden rezervasyon veya randevu talebi gönderebilsin</Text>
              </View>
            </View>
            <Switch
              value={allowReservation}
              onValueChange={(v) => { setAllowReservation(v); updateBusinessProfile(bizId, { allow_reservation: v }); }}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Kategori</Text>
        <View style={styles.mainRow}>
          {MAIN_CATEGORIES.map((m) => {
            const active = main === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => { setMain(m.id); setSub(subCategoriesOf(m.id)[0].id); }}
                style={[styles.mainCard, active && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
              >
                <MaterialCommunityIcons name={m.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={22} color={active ? colors.primary : colors.textSubtle} />
                <Text style={[styles.mainText, active && { color: colors.primaryDark }]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.subWrap}>
          {subs.map((c) => {
            const active = sub === c.id;
            return (
              <Pressable key={c.id} onPress={() => setSub(c.id)} style={[styles.subChip, active && styles.subChipActive]}>
                <MaterialCommunityIcons name={c.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={15} color={active ? colors.onPrimary : colors.textSubtle} />
                <Text style={[styles.subText, active && { color: colors.onPrimary }]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Konum</Text>
        <View style={styles.card}>
          <Field label="Adres" value={address} onChangeText={setAddress} placeholder="Açık adres" multiline />
          <View style={styles.locRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={18} color={lat != null ? colors.success : colors.textFaint} />
            <Text style={styles.locText}>
              {lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'Konum eklenmedi'}
            </Text>
          </View>
          <View style={styles.locBtns}>
            <View style={{ flex: 1 }}>
              <Button label={locating ? 'Alınıyor...' : 'Konumumu Kullan'} icon="crosshairs-gps" variant="secondary" onPress={useMyLocation} loading={locating} />
            </View>
            {lat != null && lng != null ? (
              <View style={{ flex: 1 }}>
                <Button label="Haritada Aç" icon="map-outline" variant="secondary" onPress={openOnMap} />
              </View>
            ) : null}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Galeri</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
          <Pressable style={styles.addGallery} onPress={addGalleryImage}>
            {uploadingGallery ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <MaterialCommunityIcons name="image-plus" size={24} color={colors.primary} />
                <Text style={styles.addGalleryText}>Ekle</Text>
              </>
            )}
          </Pressable>
          {images.map((uri) => (
            <View key={uri} style={styles.galleryItem}>
              <Image source={{ uri }} style={styles.galleryImg} contentFit="cover" transition={150} />
              <Pressable style={styles.galleryRemove} hitSlop={8} onPress={() => removeGalleryImage(uri)}>
                <MaterialCommunityIcons name="close" size={14} color={colors.white} />
              </Pressable>
            </View>
          ))}
        </ScrollView>

        {allowMenu ? (
          <>
            <Text style={styles.sectionTitle}>{isService ? 'Hizmetler & Fiyatlar' : 'Fiyat Listesi'}</Text>
            <View style={styles.card}>
              {menu.length === 0 ? (
                <Text style={styles.emptyMenu}>Henüz kalem eklenmedi. Aşağıdan ekleyebilirsin.</Text>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {menu.map((it) => (
                    <View key={it.id} style={styles.menuRow}>
                      <Pressable style={styles.itemThumb} onPress={() => setExistingItemImage(it.id)}>
                        {itemImageBusy === it.id ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : it.image_url ? (
                          <Image source={{ uri: it.image_url }} style={styles.itemThumbImg} contentFit="cover" />
                        ) : (
                          <MaterialCommunityIcons name="camera-plus-outline" size={18} color={colors.textFaint} />
                        )}
                      </Pressable>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.menuName} numberOfLines={1}>{it.name}</Text>
                        {it.group_name || it.duration_min ? (
                          <Text style={styles.menuMeta}>
                            {[it.group_name, it.duration_min ? `${it.duration_min} dk` : null].filter(Boolean).join(' · ')}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={styles.menuPrice}>{Number(it.price).toLocaleString('tr-TR')} ₺</Text>
                      <Pressable hitSlop={8} onPress={() => removeMenuItem(it.id)} style={styles.menuDelete}>
                        <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.danger} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.divider} />
              <Text style={styles.addTitle}>{isService ? 'Hizmet Ekle' : 'Ürün Ekle'}</Text>
              <Text style={styles.helperText}>Aynı "Grup / Başlık" altındaki ürünler kullanıcıya tek başlıkta ve yana kaydırmalı olarak gösterilir.</Text>
              <Field label={isService ? 'Hizmet Adı' : 'Ürün Adı'} value={miName} onChangeText={setMiName} placeholder={isService ? 'Örn. Saç Kesimi' : 'Örn. Adana Kebap'} />
              <Field label="Kısa açıklama / içerik" value={miDescription} onChangeText={setMiDescription} placeholder="Ürünün içeriği veya hizmet açıklaması" multiline />
              <View style={styles.inlineRow}>
                <View style={{ flex: 1 }}>
                  <Field label="Fiyat (₺)" value={miPrice} onChangeText={setMiPrice} placeholder="0" keyboardType="numeric" />
                </View>
                {isService ? (
                  <View style={{ flex: 1 }}>
                    <Field label="Süre (dk)" value={miDuration} onChangeText={setMiDuration} placeholder="Örn. 30" keyboardType="numeric" />
                  </View>
                ) : null}
              </View>
              <Field
                label="Grup / Başlık"
                value={miGroup}
                onChangeText={setMiGroup}
                placeholder={isService ? 'Örn. Saç, Cilt Bakımı' : 'Örn. İçecekler, Dönerler'}
              />
              <Pressable style={styles.itemImagePick} onPress={pickItemImage}>
                {miImage ? (
                  <Image source={{ uri: miImage.uri }} style={styles.itemImagePreview} contentFit="cover" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="image-plus" size={20} color={colors.primary} />
                    <Text style={styles.itemImagePickText}>Ürün fotoğrafı ekle (opsiyonel)</Text>
                  </>
                )}
              </Pressable>
              {miImage ? (
                <Pressable onPress={() => setMiImage(null)} style={styles.itemImageClear}>
                  <MaterialCommunityIcons name="close" size={14} color={colors.danger} />
                  <Text style={styles.itemImageClearText}>Fotoğrafı kaldır</Text>
                </Pressable>
              ) : null}
              <Button label={addingItem ? 'Ekleniyor...' : 'Listeye Ekle'} icon="plus" variant="secondary" onPress={submitMenuItem} loading={addingItem} />
            </View>
          </>
        ) : null}

        <Button label={saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'} icon="content-save-outline" onPress={save} loading={saving} />

        <Button label="Kampanya Ekle" icon="sale" variant="secondary" onPress={() => router.push('/business/campaigns')} />

        <View style={styles.quickRow}>
          <View style={{ flex: 1 }}>
            <Button label="Reklam Ver" icon="bullhorn-outline" variant="secondary" onPress={() => router.push('/business/ads')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Paylaşım Ekle" icon="image-plus" variant="secondary" onPress={() => router.push('/business/posts')} />
          </View>
        </View>

        <Button label="Bildirim Gönder" icon="bell-plus-outline" variant="secondary" onPress={() => router.push('/business/notifications')} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad' | 'numeric' | 'email-address';
}) {
  const { colors, styles } = useThemeStyles(createStyles);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        style={[styles.input, multiline && styles.textArea]}
        multiline={multiline}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        accessibilityLabel={label}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  guard: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.background },
  guardText: { fontSize: fontSize.md, color: colors.textSubtle, textAlign: 'center' },

  cover: { height: 150, borderRadius: radius.lg, backgroundColor: colors.surfaceTint, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  coverEmpty: { alignItems: 'center', gap: 6 },
  coverText: { fontSize: fontSize.sm, color: colors.textSubtle },
  coverEditBadge: { position: 'absolute', right: spacing.sm, bottom: spacing.sm, backgroundColor: 'rgba(0,0,0,0.5)', width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { width: 64, height: 64, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  logoImg: { width: '100%', height: '100%', borderRadius: radius.lg - 1 },
  logoEditBadge: { position: 'absolute', right: -4, bottom: -4, backgroundColor: colors.primary, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.background },
  bizName: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginBottom: 4 },

  noteBox: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  noteBoxDanger: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft },
  noteText: { flex: 1, fontSize: fontSize.xs, color: colors.textSubtle, lineHeight: fontSize.xs * 1.5 },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text, marginTop: spacing.sm },

  openRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  openTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  openSub: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
  modeRow: { flexDirection: 'row', gap: spacing.sm },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  modeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSubtle },
  helperText: { fontSize: fontSize.xs, color: colors.textSubtle, lineHeight: fontSize.xs * 1.5 },
  orderSettings: { gap: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dayChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  dayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { fontSize: fontSize.sm, color: colors.textSubtle, fontWeight: fontWeight.medium },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.xs },
  previewOpen: { backgroundColor: colors.successSoft },
  previewClosed: { backgroundColor: colors.dangerSoft },
  previewText: { flex: 1, fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.medium },

  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.text },
  input: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: fontSize.md, color: colors.text },
  textArea: { height: 80, textAlignVertical: 'top' },

  mainRow: { flexDirection: 'row', gap: spacing.md },
  mainCard: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, alignItems: 'flex-start', backgroundColor: colors.surface },
  mainText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  subWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  subChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  subChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  subText: { fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.medium },

  locRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  locText: { fontSize: fontSize.sm, color: colors.textSubtle },
  locBtns: { flexDirection: 'row', gap: spacing.sm },

  gallery: { gap: spacing.sm, paddingVertical: spacing.xs },
  addGallery: { width: 92, height: 92, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 4 },
  addGalleryText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: fontWeight.medium },
  galleryItem: { width: 92, height: 92, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceTint },
  galleryImg: { width: '100%', height: '100%' },
  galleryRemove: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.55)', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

  emptyMenu: { fontSize: fontSize.sm, color: colors.textSubtle },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  menuName: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.text },
  menuMeta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
  menuPrice: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primary },
  menuDelete: { padding: 4 },
  itemThumb: { width: 42, height: 42, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  itemThumbImg: { width: '100%', height: '100%' },
  itemImagePick: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 88, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  itemImagePreview: { width: '100%', height: '100%' },
  itemImagePickText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.medium },
  itemImageClear: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4 },
  itemImageClearText: { fontSize: fontSize.xs, color: colors.danger },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  addTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  inlineRow: { flexDirection: 'row', gap: spacing.md },

  quickRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
});
