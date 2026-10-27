import React, { memo, useMemo } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CafeTable, cafeGridColumns } from '@/services/cafeSeatingService';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { createCafeStyles } from '@/constants/cafeStyles';
import { spacing } from '@/constants/theme';
interface CafeTablePlanProps { tables: CafeTable[]; selected?: string; onSelect?: (id: string) => void; disabled?: boolean }
export const CafeTablePlan = memo(function CafeTablePlan({ tables, selected, onSelect, disabled }: CafeTablePlanProps) {
 const { colors: c, styles: s } = useThemeStyles(createCafeStyles);
 const cells = useMemo(() => {
  const rows = Math.max(2, ...tables.map(table => table.grid_y + 1));
  return Array.from({ length: rows * cafeGridColumns }, (_, index) => ({ id: String(index), table: tables.find(table => table.grid_x === index % cafeGridColumns && table.grid_y === Math.floor(index / cafeGridColumns)) }));
 }, [tables]);
 const cellSize = spacing.xxxl + spacing.xxl;
 return <View style={[s.planOuter, { height: cells.length / cafeGridColumns * cellSize + spacing.lg }]}>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.planScroll}>
   <FlatList scrollEnabled={false} numColumns={cafeGridColumns} style={{ width: cafeGridColumns * cellSize }} data={cells} keyExtractor={item => item.id} renderItem={({ item }) => <View style={[s.planCell, { width: cellSize, height: cellSize }]}>
    {item.table ? onSelect ? <Pressable accessibilityRole="button" accessibilityLabel={`${item.table.label}, ${item.table.seats} kişilik, satır ${item.table.grid_y + 1}, sütun ${item.table.grid_x + 1}`} accessibilityState={{ selected: selected === item.table.id, disabled: !!disabled }} disabled={disabled} onPress={() => onSelect(item.table!.id)} style={({ pressed }) => [s.table, selected === item.table?.id ? s.selected : null, pressed ? s.pressed : null]}><MaterialCommunityIcons name="table-chair" color={c.primaryDark} size={24} /><Text style={s.tableLabel} numberOfLines={1}>{item.table.label}</Text><Text style={s.tableLabel}>{item.table.seats} kişilik</Text></Pressable> : <View style={s.table}><MaterialCommunityIcons name="table-chair" color={c.primaryDark} size={24} /><Text style={s.tableLabel} numberOfLines={1}>{item.table.label}</Text><Text style={s.tableLabel}>{item.table.seats} kişilik</Text></View> : <View style={s.emptyCell} />}
   </View>} />
  </ScrollView>
 </View>;
});
