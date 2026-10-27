import { Tabs } from 'expo-router/tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { AccountRouteBoundary } from '@/components/auth/AccountRouteBoundary';
export default function BusinessTabLayout() {
 const insets = useSafeAreaInsets(); const { colors } = useTheme();
 return <AccountRouteBoundary><Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textFaint, tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: Platform.OS === 'web' ? 70 : insets.bottom + 60, paddingTop: 8, paddingBottom: Platform.OS === 'web' ? 8 : insets.bottom + 8, paddingHorizontal: 16 }, tabBarLabelStyle: { fontSize: 11, fontWeight: '600' } }}>
 <Tabs.Screen name="index" options={{ title: 'İşletmelerim', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="storefront-outline" color={color} size={size} /> }} />
 <Tabs.Screen name="requests" options={{ title: 'Talepler', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="calendar-check-outline" color={color} size={size} /> }} />
 <Tabs.Screen name="publishing" options={{ title: 'Paylaşımlar', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="image-multiple-outline" color={color} size={size} /> }} />
 <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-outline" color={color} size={size} /> }} />
 </Tabs></AccountRouteBoundary>;
}
