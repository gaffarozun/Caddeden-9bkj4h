// Powered by OnSpace.AI
import React, { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { AdminLoading, SmallButton, StatusPill } from '@/components/admin/ui';
import { adminApi } from '@/services/adminService';
import { AD_TYPE_LABELS } from '@/services/adService';
import { useAlert } from '@/template';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { caddeTvDisplayName } from '@/services/caddeTvService';

interface Pkg {
  id: string;
  name: string;
  type: string;
  price: string;
  duration_days: string;
  active: boolean;
}

export default function AdminPackages() {
  const { colors, styles } = useThemeStyles(createStyles);
  const { showAlert } = useAlert();
  const [items, setItems] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await adminApi.listAdPackages();
    if (error) {
      showAlert('Hata', error, [{ text: 'Tamam' }]);
    } else {
      setItems(
        ((data?.packages as any[]) ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          price: String(p.price),
          duration_days: String(p.duration_days),
          active: !!p.active,
        }))
      );
    }
    setLoading(false);
  }, [showAlert]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (id: string, patch: Partial<Pkg>) =>
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const save = async (p: Pkg) => {
    const price = Number(p.price);
    const duration = Number(p.duration_days);
    if (!Number.isFinite(price) || price < 0 || (p.type === 'content_campaign' && p.active && price <= 0)) {
      showAlert('Geçersiz fiyat', p.type === 'content_campaign' ? 'Aktif kampanya bandı paketinde fiyat sıfırdan büyük olmalı.' : 'Fiyat 0 veya daha büyük olmalı.', [{ text: 'Tamam' }]);
      return;
    }
    if (!Number.isInteger(duration) || duration < 1) {
      showAlert('Geçersiz süre', 'Süre en az 1 gün olmalı.', [{ text: 'Tamam' }]);
      return;
    }
    setSavingId(p.id);
    const { error } = await adminApi.upsertAdPackage({
      id: p.id,
      name: p.name,
      price,
      duration_days: duration,
      active: p.active,
    });
    setSavingId(null);
    if (error) {
      showAlert('Kaydedilemedi', error, [{ text: 'Tamam' }]);
      return;
    }
    showAlert('Kaydedildi', 'Paket fiyatı güncellendi.', [{ text: 'Tamam' }]);
    load();
  };

  if (loading) return <AdminLoading />;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.note}>
          Reklam, Cadde TV/Gönderi, kampanya ve bildirim paketlerinin fiyatını yalnızca sen belirlersin. İşletmeler bu fiyatları görerek başvurur; hiçbir içerik sen onaylamadan yayınlanmaz.
        </Text>

        {items.map((p) => (
          <View key={p.id} style={styles.card}>
            <View style={styles.rowTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{caddeTvDisplayName(p.name)}</Text>
                <Text style={styles.type}>{AD_TYPE_LABELS[p.type] ?? p.type}</Text>
              </View>
              <StatusPill label={p.type === 'content_campaign' && Number(p.price) <= 0 ? 'Ücret belirle' : p.active ? 'Aktif' : 'Pasif'} tone={p.type === 'content_campaign' && Number(p.price) <= 0 ? 'warning' : p.active ? 'success' : 'neutral'} />
            </View>

            {p.type === 'content_campaign' ? <Text style={styles.note}>Güncel Kampanyalar LED bandı · Sıfırdan büyük bir fiyat belirleyip kaydet. İşletme başvurusu bu ücreti kullanır; ödeme manuel doğrulanır ve ayrıca yayın onayı gerekir. Yeni fiyat mevcut başvuruların ücretini değiştirmez.</Text> : null}

            <View style={styles.fieldRow}>
              <View style={styles.field}>
                <Text style={styles.label}>Fiyat (₺)</Text>
                <TextInput
                  value={p.price}
                  onChangeText={(t) => update(p.id, { price: t })}
                  keyboardType="numeric"
                  style={styles.input}
                  accessibilityLabel={`${p.name} fiyatı`}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Süre (gün)</Text>
                <TextInput
                  value={p.duration_days}
                  onChangeText={(t) => update(p.id, { duration_days: t })}
                  keyboardType="numeric"
                  style={styles.input}
                  accessibilityLabel={`${p.name} süresi`}
                />
              </View>
            </View>

            <View style={styles.activeRow}>
              <Text style={styles.label}>Satışta (aktif)</Text>
              <Switch
                value={p.active}
                onValueChange={(v) => update(p.id, { active: v })}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.white}
              />
            </View>

            <SmallButton
              label={savingId === p.id ? 'Kaydediliyor...' : 'Kaydet'}
              icon="content-save-outline"
              onPress={() => save(p)}
              disabled={savingId !== null}
            />
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  note: { fontSize: fontSize.sm, color: colors.textSubtle, lineHeight: fontSize.sm * 1.5 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  type: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
  fieldRow: { flexDirection: 'row', gap: spacing.md },
  field: { flex: 1, gap: 4 },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.text },
  input: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: fontSize.md, color: colors.text },
  activeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
});
