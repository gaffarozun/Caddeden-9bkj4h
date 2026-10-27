// Powered by OnSpace.AI
import React, { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from '@/components';
import { AdminEmpty, StatusPill } from '@/components/admin/ui';
import { adminApi } from '@/services/adminService';
import { SUB_CATEGORIES } from '@/services/categories';
import { useAlert } from '@/template';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
import { useThemeStyles } from '@/hooks/useThemeStyles';

interface Notif {
  id: string;
  title: string;
  body: string;
  target: string;
  target_category?: string | null;
  created_at: string;
}

export default function AdminNotifications() {
  const { colors, styles } = useThemeStyles(createStyles);
  const { showAlert } = useAlert();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<'all' | 'business' | 'user' | 'category'>('all');
  const [category, setCategory] = useState<string>('restoran');
  const [sending, setSending] = useState(false);
  const [list, setList] = useState<Notif[]>([]);

  const load = useCallback(async () => {
    const { data } = await adminApi.listNotifications();
    setList((data?.notifications as Notif[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    if (!title.trim() || !message.trim()) {
      showAlert('Eksik bilgi', 'Başlık ve mesaj alanlarını doldur.', [{ text: 'Tamam' }]);
      return;
    }
    setSending(true);
    const { error } = await adminApi.sendNotification({
      title: title.trim(),
      message: message.trim(),
      target,
      target_category: target === 'category' ? category : null,
      type: 'announcement',
    });
    setSending(false);
    if (error) {
      showAlert('Gönderilemedi', error, [{ text: 'Tamam' }]);
      return;
    }
    setTitle('');
    setMessage('');
    showAlert('Gönderildi', 'Bildirim yayınlandı.', [{ text: 'Tamam' }]);
    load();
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.label}>Başlık</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Kampanya başlığı" placeholderTextColor={colors.textFaint} style={styles.input} />

          <Text style={styles.label}>Mesaj</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Kullanıcılara iletilecek duyuru"
            placeholderTextColor={colors.textFaint}
            style={[styles.input, styles.textArea]}
            multiline
          />

          <Text style={styles.label}>Hedef Kitle</Text>
          <View style={styles.targetRow}>
            <TargetBtn label="Tüm kullanıcılar" active={target === 'all'} onPress={() => setTarget('all')} />
            <TargetBtn label="Sadece işletmeler" active={target === 'business'} onPress={() => setTarget('business')} />
            <TargetBtn label="Sadece kullanıcılar" active={target === 'user'} onPress={() => setTarget('user')} />
            <TargetBtn label="Kategoriye göre" active={target === 'category'} onPress={() => setTarget('category')} />
          </View>

          {target === 'category' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
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

          <View style={{ marginTop: spacing.md }}>
            <Button label={sending ? 'Gönderiliyor...' : 'Bildirimi Gönder'} icon="send" onPress={send} loading={sending} />
          </View>
        </View>

        <Text style={styles.recentTitle}>Son Gönderilenler</Text>
        {list.length === 0 ? (
          <AdminEmpty icon="bell-outline" text="Henüz bildirim gönderilmedi." />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {list.map((n) => (
              <View key={n.id} style={styles.notifRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.notifTitle} numberOfLines={1}>{n.title}</Text>
                  <Text style={styles.notifBody} numberOfLines={2}>{n.body}</Text>
                </View>
                <StatusPill
                  label={
                    n.target === 'all'
                      ? 'Tümü'
                      : n.target === 'business'
                      ? 'İşletmeler'
                      : n.target === 'user'
                      ? 'Kullanıcılar'
                      : n.target_category ?? 'Kategori'
                  }
                  tone={n.target === 'all' ? 'info' : 'primary'}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TargetBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors, styles } = useThemeStyles(createStyles);
  return (
    <Pressable onPress={onPress} style={[styles.targetBtn, active && styles.targetBtnActive]}>
      <MaterialCommunityIcons name={active ? 'radiobox-marked' : 'radiobox-blank'} size={18} color={active ? colors.primary : colors.textFaint} />
      <Text style={[styles.targetText, active && { color: colors.text, fontWeight: fontWeight.semibold }]}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.text, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: fontSize.md,
    color: colors.text,
  },
  textArea: { height: 90, textAlignVertical: 'top' },
  targetRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  targetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  targetBtnActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  targetText: { fontSize: fontSize.sm, color: colors.textSubtle },
  chips: { gap: spacing.sm, paddingVertical: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.medium },
  recentTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  notifTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  notifBody: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
});
