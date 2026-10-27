// Powered by OnSpace.AI
import { useLocalSearchParams } from 'expo-router';
import { AdminUsersView } from '@/components/admin/AdminUsersView';

export default function AdminUsersScreen() {
  const { account } = useLocalSearchParams<{ account?: string | string[] }>();
  const value = Array.isArray(account) ? account[0] : account;
  const initialFilter = value === 'business' ? 'business' : value === 'admin' ? 'admin' : 'user';
  return <AdminUsersView initialFilter={initialFilter} />;
}
