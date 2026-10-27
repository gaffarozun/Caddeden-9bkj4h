import { memo } from 'react';
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCafeArrivalState } from '@/hooks/useCafeArrivalState';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { createCafeStyles } from '@/constants/cafeStyles';
import { FeedbackButton } from './FeedbackControls';
interface CafeArrivalStatusCardProps { compact?: boolean }
export const CafeArrivalStatusCard = memo(function CafeArrivalStatusCard({ compact = false }: CafeArrivalStatusCardProps) {
 const m = useCafeArrivalState(); const { colors: c, styles: s } = useThemeStyles(createCafeStyles);
 return <View style={s.scanNotice}>
  {!compact ? <View style={s.row}><MaterialCommunityIcons name="crosshairs-gps" size={22} color={c.primaryDark} /><Text style={s.label}>Mekân onayı</Text></View> : null}
  <FeedbackButton compact secondary busy={m.checking} disabled={m.busy} label="Yakındaki mekânlar" icon="map-marker-check-outline" onPress={m.scan} />
  <FeedbackButton compact secondary disabled={m.checking || m.busy} label="Konum ayarları" icon="cog-outline" onPress={() => { void m.openSettings(); }} />
  {!compact ? <Text style={s.ratioLabel} accessibilityLiveRegion="polite">{m.status}</Text> : null}
 </View>;
});
