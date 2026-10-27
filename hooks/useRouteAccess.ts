import { usePathname, useSegments } from 'expo-router';
import { useAuth } from './useAuth';

export function useRouteAccess() {
  const { authUser, isAdmin, loading, profileError } = useAuth();
  const path = usePathname();
  const group = (useSegments() as string[])[0] ?? '';
  const manager = /^\/business\/(manage|register|ads|posts|campaigns|requests|notifications)(\/|$)/.test(path);
  const businessTabs = group === '(business-tabs)';
  const customerAction = /^\/business\/(reserve|rate)(\/|$)/.test(path);
  const active = authUser?.status === 'active';
  const canManage = active && (isAdmin || (authUser?.role === 'business' && authUser.businessAccess));
  // This boundary checks route category only. Ownership and current approval are
  // verified by the existing data services and RLS for each protected operation.
  // No repeated network check that unmounts the editor on every auth refresh.
  const blocked = (manager && !canManage)
    || (businessTabs && (!canManage || (!isAdmin && authUser?.role !== 'business')))
    || (customerAction && !!authUser && authUser.role !== 'user');
  const home = isAdmin ? '/(business-tabs)' as const : authUser?.role === 'business'
    ? (authUser.businessAccess ? '/(business-tabs)' as const : '/business-approval' as const)
    : '/(tabs)' as const;
  return { checking: loading && (manager || businessTabs || customerAction), blocked, error: profileError, home };
}
