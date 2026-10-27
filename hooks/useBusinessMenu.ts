import { useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { menuGroups } from '@/services/businessProfileService';
import { useBusinessProfile } from './useBusinessProfile';
import { useBusinessOrder } from './useBusinessOrder';
export function useBusinessMenu(id: string) {
  const { itemId } = useLocalSearchParams<{ itemId?: string | string[] }>();
  const targetItemId = Array.isArray(itemId) ? itemId[0] : itemId;
  const profile = useBusinessProfile(id); const order = useBusinessOrder(profile.business, profile.canOrder);
  const [selected, setSelected] = useState(''); const [photo, setPhoto] = useState<string | null>(null);
  const groups = useMemo(() => menuGroups(profile.business?.menu ?? []), [profile.business?.menu]);
  const group = groups.find(value => value.name === selected)
    ?? groups.find(value => value.items.some(item => item.id === targetItemId)) ?? groups[0];
  const banner = profile.business?.menuGroupCovers?.[group?.name ?? ''] || profile.business?.menuCover;
  return { profile, order, groups, group, setSelected, photo, setPhoto, banner };
}
