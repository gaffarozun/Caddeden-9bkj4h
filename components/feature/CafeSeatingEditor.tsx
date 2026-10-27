import React, { memo } from 'react';
import { ActivityIndicator, FlatList, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCafeSeatingEditor } from '@/hooks/useCafeSeatingEditor';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { createCafeStyles } from '@/constants/cafeStyles';
import { CafeTablePlan } from './CafeTablePlan';
import { FeedbackButton, FeedbackError } from './FeedbackControls';
interface CafeSeatingEditorProps { businessId: string }
const moves: { id: string; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; dx: number; dy: number }[] = [
 { id: 'left', label: 'Masayı sola taşı', icon: 'arrow-left', dx: -1, dy: 0 }, { id: 'up', label: 'Masayı yukarı taşı', icon: 'arrow-up', dx: 0, dy: -1 }, { id: 'down', label: 'Masayı aşağı taşı', icon: 'arrow-down', dx: 0, dy: 1 }, { id: 'right', label: 'Masayı sağa taşı', icon: 'arrow-right', dx: 1, dy: 0 },
];
export const CafeSeatingEditor = memo(function CafeSeatingEditor({ businessId }: CafeSeatingEditorProps) {
 const m = useCafeSeatingEditor(businessId); const { colors: c, styles: s } = useThemeStyles(createCafeStyles);
 return <View style={s.card}>
  <View style={s.row}><MaterialCommunityIcons name="table-chair" color={c.primaryDark} size={28} /><View style={s.info}><Text style={s.title}>Doluluk kapasitesi</Text></View></View>
  {!m.ready ? <><ActivityIndicator color={c.primary} /><FeedbackError message={m.error} /></> : <>
   <View style={s.row}><Text style={[s.label, s.info]}>Doluluk yüzdesini göster</Text><Switch accessibilityLabel="Doluluk yüzdesi gösterimi" disabled={m.busy} value={m.enabled} onValueChange={m.changeEnabled} trackColor={{ true: c.primary, false: c.border }} thumbColor={c.onPrimary} /></View>
   <View style={s.badge}><Text style={s.badgeText}>{m.tables.length} masa · {m.capacity} kişilik kapasite</Text></View>
   
   <CafeTablePlan tables={m.tables} selected={m.selected} onSelect={m.select} disabled={m.busy} />
   <FeedbackButton secondary disabled={m.busy || m.tables.length >= 60} label="Masa ekle" icon="plus" onPress={m.add} />
   {m.table ? <View style={s.editPanel}>
    <Text style={s.label}>Seçili masa adı</Text><TextInput accessibilityLabel="Seçili masa adı" value={m.table.label} onChangeText={label => m.update({ label })} editable={!m.busy} maxLength={24} style={s.input} />
    <View style={s.row}><Text style={[s.label, s.info]}>Kapasite: {m.table.seats} kişi</Text><Pressable accessibilityLabel="Masa kapasitesini azalt" disabled={m.busy || m.table.seats <= 1} style={({ pressed }) => [s.control, pressed ? s.pressed : null]} onPress={() => m.update({ seats: Math.max(1, (m.table?.seats ?? 1) - 1) })}><MaterialCommunityIcons name="minus" size={24} color={c.primaryDark} /></Pressable><Pressable accessibilityLabel="Masa kapasitesini artır" disabled={m.busy || m.table.seats >= 12} style={({ pressed }) => [s.control, pressed ? s.pressed : null]} onPress={() => m.update({ seats: Math.min(12, (m.table?.seats ?? 1) + 1) })}><MaterialCommunityIcons name="plus" size={24} color={c.primaryDark} /></Pressable></View>
    <Text style={s.text}>Satır {m.table.grid_y + 1} · Sütun {m.table.grid_x + 1}</Text>
    <View style={s.moveRail}><FlatList horizontal data={moves} keyExtractor={item => item.id} contentContainerStyle={s.members} showsHorizontalScrollIndicator={false} renderItem={({ item }) => <Pressable accessibilityLabel={item.label} disabled={m.busy} style={({ pressed }) => [s.control, pressed ? s.pressed : null]} onPress={() => m.move(item.dx, item.dy)}><MaterialCommunityIcons name={item.icon} size={24} color={c.primaryDark} /></Pressable>} /></View>
    <FeedbackButton secondary danger disabled={m.busy} label="Seçili masayı kaldır" icon="trash-can-outline" onPress={m.remove} />
   </View> : null}
   {m.tables.length === 0 ? <Text style={s.text}>Gösterimi açmak için önce Masa ekle ile en az bir masa oluşturun ve planı kaydedin.</Text> : null}
   
   <FeedbackButton busy={m.busy} disabled={!m.dirty} label="Masa planını kaydet" icon="content-save-outline" onPress={() => { void m.save(); }} />
   <FeedbackError message={m.error} />{m.notice ? <Text style={s.text} accessibilityLiveRegion="polite">{m.notice}</Text> : null}
  </>}
 </View>;
});
