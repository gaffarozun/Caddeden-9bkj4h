import { memo, useMemo } from 'react';
import { FlatList, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { CafeRoom } from '@/services/cafePresenceService';
import { venueRatioPairs } from '@/services/venueDemographicsService';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { createCafeStyles } from '@/constants/cafeStyles';
interface CafeOccupancyCardProps { room: CafeRoom }
export const CafeOccupancyCard = memo(function CafeOccupancyCard({ room }: CafeOccupancyCardProps) {
 const { colors: c, styles: s } = useThemeStyles(createCafeStyles);
 const pairs = useMemo(() => venueRatioPairs(room.demographics), [room.demographics]);
 if (!room.occupancy_enabled || !room.occupancy_visible) return null;
 const value = room.occupancy_percent;
 const percent = typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : null;
 return <View style={s.card}>
  <View style={s.row}><MaterialCommunityIcons name="chart-donut" size={22} color={c.primaryDark} /><Text style={s.title}>Doluluk</Text><Text style={s.occupancyValue}>{percent === null ? '—' : `%${percent}`}</Text><Text style={s.ratioLabel}>{room.count} kişi</Text></View>
  {percent !== null ? <View style={s.progressTrack} accessible accessibilityRole="progressbar" accessibilityLabel="Tahmini doluluk" accessibilityValue={{ min: 0, max: 100, now: percent }}><View style={[s.progressFill, { width: `${percent}%` }]} /></View> : null}
  <FlatList data={pairs} scrollEnabled={false} keyExtractor={item => item.id} contentContainerStyle={s.compactPanel} renderItem={({ item }) => <View style={s.ratioPair}>
   <View style={s.ratioCell}><Text style={s.ratioValue}>{item.first === null ? '—' : `%${item.first}`}</Text><Text style={s.ratioLabel}>{item.firstLabel}</Text></View>
   <View style={s.ratioCell}><Text style={s.ratioValue}>{item.second === null ? '—' : `%${item.second}`}</Text><Text style={s.ratioLabel}>{item.secondLabel}</Text></View>
  </View>} />
 </View>;
});
