// Powered by OnSpace.AI
// Business notification requests: a business composes an announcement and sets
// how many times, which hours and which weekdays it should be sent. The request
// is priced from an admin plan and goes to the admin for approval — only approved
// requests are actually published to users.
import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button } from '@/components';
import { AccountRouteBoundary } from '@/components/auth/AccountRouteBoundary';
import { AdminEmpty, AdminLoading, StatusPill } from '@/components/admin/ui';
import { useAuth } from '@/hooks/useAuth';
import { AdPackage, MyBusiness, listActivePackagesByTypes, listMyBusinesses } from '@/services/adService';
import { SUB_CATEGORIES } from '@/services/categories';
import { WEEKDAYS } from '@/services/businessStatus';
import { timeAgo } from '@/services/contentService';
import {
  MyNotificationRequest,
  createNotificationRequest,
  deleteNotificationRequest,
  listMyNotificationRequests,
  notifRequestStatusMeta,
} from '@/services/notificationRequestService';
import { useAlert } from '@/template';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
import { useThemeStyles } from '@/hooks/useThemeStyles';

export default function BusinessNotificationsScreen() { return <AccountRouteBoundary><BusinessNotifications /></AccountRouteBoundary>; }
function BusinessNotifications() {
  const { colors, styles } = useThemeStyles(createStyles);
  const router = useRouter();
  const { showAlert } = useAlert();
  const { authUser } = useAuth();

  const [businesses, setBusinesses] = useState<MyBusiness[]>([]);
  const [packages, setPackages] = useState<AdPackage[]>([]);
  const [items, setItems] = useState<MyNotificationRequest[]>([]);
  const [bizId, setBizId] = useState('');
  const [planId, setPlanId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetMode, setTargetMode] = useState<'all' | 'category'>('all');
  const [category, setCategory] = useState('restoran');
  const [count, setCount] = useState(1);
  const [timeStart, setTimeStart] = useState('10:00');
  const [timeEnd, setTimeEnd] = useState('20:00');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!authUser) {
      setLoading(false);
      return;
    }
    const [b, p, r] = await Promise.all([
      listMyBusinesses(authUser.id),
      listActivePackagesByTypes(['business_notification']),
      listMyNotificationRequests(authUser.id),
    ]);
    setBusinesses(b.data);
    setPackages(p.data);
    setItems(r.data);
    setBizId((prev) => prev || (b.data[0]?.id ?? ''));
    setLoading(false);
  }, [authUser]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const selectedPlan = useMemo(() => packages.find((p) => p.id === planId), [packages, planId]);

  if (!authUser) {
    return (
      <View style={styles.guard}>
        <MaterialCommunityIcons name="account-lock-outline" size={48} color={colors.textFaint} />
        <Text style={styles.guardText}>Bildirim göndermek için giriş yapmalısın.</Text>
        <Button label="Giriş Yap" icon="login" onPress={() => router.replace('/auth')} />
      </View>
    );
  }

  if (loading) return <AdminLoading />;

  if (businesses.length === 0) {
    return (
      <View style={styles.guard}>
        <MaterialCommunityIcons name="storefront-outline" size={48} color={colors.textFaint} />
        <Text style={styles.guardText}>Bildirim göndermek için önce bir işletme eklemelisin.</Text>
        <Button label="İşletme Ekle" icon="plus" onPress={() => router.replace('/business/register')} />
      </View>
    );
  }

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const submit = async () => {
    if (!bizId) {
      showAlert('Eksik bilgi', 'İşletme seç.', [{ text: 'Tamam' }]);
      return;
    }
    if (!title.trim() || !body.trim()) {
      showAlert('Eksik bilgi', 'Başlık ve mesaj alanlarını doldur.', [{ text: 'Tamam' }]);
      return;
    }
    if (days.length === 0) {
      showAlert('Gün seç', 'En az bir gün seçmelisin.', [{ text: 'Tamam' }]);
      return;
    }
    if (packages.length > 0 && !selectedPlan) {
      showAlert('Plan seç', 'Bildirim planı ve ücretini seç.', [{ text: 'Tamam' }]);
      return;
    }
    setSaving(true);
    const { error } = await createNotificationRequest({
      business_id: bizId,
      package_id: selectedPlan?.id ?? null,
      price: (selectedPlan?.price ?? 0) * count,
      title: title.trim(),
      body: body.trim(),
      target_category: targetMode === 'category' ? category : null,
      send_count: count,
      time_start: timeStart.trim() || null,
      time_end: timeEnd.trim() || null,
      days,
    });
    setSaving(false);
    if (error) {
      showAlert('Gönderilemedi', error, [{ text: 'Tamam' }]);
      return;
    }
    setTitle('');
    setBody('');
    setPlanId('');
    setCount(1);
    showAlert('Gönderildi', 'Bildirim talebin yönetici onayına iletildi. Onaylanınca kullanıcılara iletilir.', [{ text: 'Tamam' }]);
    load();
  };

  const confirmDelete = (id: string) =>
    showAlert('Talebi sil', 'Bu bildirim talebi silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const { error } = await deleteNotificationRequest(id);
          if (error) showAlert('Silinemedi', error, [{ text: 'Tamam' }]);
          else load();
        },
      },
    ]);

  const estimatedTotal = (selectedPlan?.price ?? 0) * count;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Yeni Bildirim Talebi</Text>

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

          <Text style={styles.label}>Başlık</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Bildirim başlığı" placeholderTextColor={colors.textFaint} style={styles.input} accessibilityLabel="Başlık" />

          <Text style={styles.label}>Mesaj</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Kullanıcılara iletilecek bildirim metni"
            placeholderTextColor={colors.textFaint}
            style={[styles.input, styles.textArea]}
            multiline
            accessibilityLabel="Mesaj"
          />

          <Text style={styles.label}>Hedef Kitle</Text>
          <View style={styles.kindRow}>
            <Pressable onPress={() => setTargetMode('all')} style={[styles.kindBtn, targetMode === 'all' && styles.kindBtnActive]}>
              <MaterialCommunityIcons name="account-group-outline" size={18} color={targetMode === 'all' ? colors.onPrimary : colors.textSubtle} />
              <Text style={[styles.kindText, targetMode === 'all' && { color: colors.onPrimary }]}>Tüm kullanıcılar</Text>
            </Pressable>
            <Pressable onPress={() => setTargetMode('category')} style={[styles.kindBtn, targetMode === 'category' && styles.kindBtnActive]}>
              <MaterialCommunityIcons name="shape-outline" size={18} color={targetMode === 'category' ? colors.onPrimary : colors.textSubtle} />
              <Text style={[styles.kindText, targetMode === 'category' && { color: colors.onPrimary }]}>Kategoriye göre</Text>
            </Pressable>
          </View>
          {targetMode === 'category' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {SUB_CATEGORIES.map((c) => {
                const active = category === c.id;
                return (
                  <Pressable key={c.id} onPress={() => setCategory(c.id)} style={[styles.chip, active && styles.chipActive]}>
                    <Text style={[styles.chipText, active && { color: colors.onPrimary }]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          <Text style={styles.label}>Kaç bildirim gönderilsin?</Text>
          <View style={styles.counterRow}>
            <Pressable hitSlop={8} onPress={() => setCount((c) => Math.max(1, c - 1))}>
              <MaterialCommunityIcons name="minus-circle-outline" size={30} color={colors.primary} />
            </Pressable>
            <Text style={styles.counterValue}>{count}</Text>
            <Pressable hitSlop={8} onPress={() => setCount((c) => Math.min(30, c + 1))}>
              <MaterialCommunityIcons name="plus-circle-outline" size={30} color={colors.primary} />
            </Pressable>
          </View>

          <Text style={styles.label}>Saat Aralığı</Text>
          <View style={styles.inlineRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.subLabel}>Başlangıç</Text>
              <TextInput value={timeStart} onChangeText={setTimeStart} placeholder="10:00" placeholderTextColor={colors.textFaint} style={styles.input} accessibilityLabel="Başlangıç saati" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.subLabel}>Bitiş</Text>
              <TextInput value={timeEnd} onChangeText={setTimeEnd} placeholder="20:00" placeholderTextColor={colors.textFaint} style={styles.input} accessibilityLabel="Bitiş saati" />
            </View>
          </View>

          <Text style={styles.label}>Günler</Text>
          <View style={styles.daysRow}>
            {WEEKDAYS.map((d) => {
              const active = days.includes(d.value);
              return (
                <Pressable key={d.value} onPress={() => toggleDay(d.value)} style={[styles.dayChip, active && styles.dayChipActive]}>
                  <Text style={[styles.dayText, active && { color: colors.onPrimary }]}>{d.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {packages.length > 0 ? (
            <>
              <Text style={styles.label}>Bildirim Planı (yönetici fiyatı)</Text>
              <View style={{ gap: spacing.sm }}>
                {packages.map((p) => {
                  const active = planId === p.id;
                  return (
                    <Pressable key={p.id} onPress={() => setPlanId(p.id)} style={[styles.planCard, active && styles.planCardActive]}>
                      <MaterialCommunityIcons name={active ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={active ? colors.primary : colors.textFaint} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.planName}>{p.name}</Text>
                        <Text style={styles.planMeta}>Gönderim başına ücret</Text>
                      </View>
                      <Text style={styles.planPrice}>{Number(p.price).toLocaleString('tr-TR')} ₺</Text>
                    </Pressable>
                  );
                })}
              </View>
              {selectedPlan ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Tahmini toplam ({count} gönderim)</Text>
                  <Text style={styles.totalValue}>{estimatedTotal.toLocaleString('tr-TR')} ₺</Text>
                </View>
              ) : null}
            </>
          ) : null}

          <View style={styles.note}>
            <MaterialCommunityIcons name="shield-check-outline" size={16} color={colors.textSubtle} />
            <Text style={styles.noteText}>
              Talebin yönetici onayına gider. Yalnızca yönetici onaylarsa bildirim kullanıcılara iletilir; spam amacıyla kullanılamaz.
            </Text>
          </View>

          <Button label={saving ? 'Gönderiliyor...' : 'Onaya Gönder'} icon="send" onPress={submit} loading={saving} />
        </View>

        <Text style={styles.recentTitle}>Taleplerim</Text>
        {items.length === 0 ? (
          <AdminEmpty icon="bell-plus-outline" text="Henüz bildirim talebin yok." />
        ) : (
          <View style={{ gap: spacing.md }}>
            {items.map((it) => {
              const st = notifRequestStatusMeta(it.status);
              const dayLabels = (it.days ?? [])
                .map((d) => WEEKDAYS.find((w) => w.value === d)?.label)
                .filter(Boolean)
                .join(', ');
              return (
                <View key={it.id} style={styles.reqRow}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.itemTop}>
                      <StatusPill label={st.label} tone={st.tone} />
                      <Text style={styles.itemTime}>{timeAgo(it.created_at)}</Text>
                    </View>
                    <Text style={styles.reqTitle} numberOfLines={1}>{it.title}</Text>
                    <Text style={styles.reqBody} numberOfLines={2}>{it.body}</Text>
                    <Text style={styles.reqMeta}>
                      {it.send_count} gönderim · {it.time_start ?? '--'}-{it.time_end ?? '--'}
                      {dayLabels ? ` · ${dayLabels}` : ''}
                    </Text>
                    <View style={styles.reqBottom}>
                      <Text style={styles.reqPrice}>{Number(it.price).toLocaleString('tr-TR')} ₺</Text>
                      <StatusPill label={it.payment_status === 'paid' ? 'Ödendi' : 'Ödenmedi'} tone={it.payment_status === 'paid' ? 'success' : 'warning'} />
                    </View>
                    {it.status === 'rejected' && it.rejection_reason ? (
                      <Text style={styles.rejected}>Ret: {it.rejection_reason}</Text>
                    ) : null}
                  </View>
                  <Pressable hitSlop={8} onPress={() => confirmDelete(it.id)} style={styles.deleteBtn}>
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.danger} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
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
  subLabel: { fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 },
  chipsRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, maxWidth: 220 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.medium },
  input: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: fontSize.md, color: colors.text },
  textArea: { height: 84, textAlignVertical: 'top' },
  kindRow: { flexDirection: 'row', gap: spacing.sm },
  kindBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  kindBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  kindText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSubtle },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  counterValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text, minWidth: 32, textAlign: 'center' },
  inlineRow: { flexDirection: 'row', gap: spacing.md },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dayChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  dayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { fontSize: fontSize.sm, color: colors.textSubtle, fontWeight: fontWeight.medium },
  planCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  planCardActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  planName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  planMeta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
  planPrice: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primary },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.xs },
  totalLabel: { fontSize: fontSize.sm, color: colors.textSubtle },
  totalValue: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primary },
  note: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginVertical: spacing.sm },
  noteText: { flex: 1, fontSize: fontSize.xs, color: colors.textSubtle, lineHeight: fontSize.xs * 1.5 },
  recentTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  reqRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  itemTime: { fontSize: fontSize.xs, color: colors.textFaint },
  reqTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  reqBody: { fontSize: fontSize.sm, color: colors.textSubtle },
  reqMeta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
  reqBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  reqPrice: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primary },
  rejected: { fontSize: fontSize.xs, color: colors.danger, marginTop: 2 },
  deleteBtn: { padding: spacing.xs },
});
