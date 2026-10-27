// Powered by OnSpace.AI
import React, {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/hooks/useAuth';
import { AppUser, OrderRequest, Reservation, SavedMedia } from '@/services/types';

const STORAGE_KEY = 'caddeden_state_v3';
const GUEST: AppUser = { id: 'guest', name: 'Misafir', type: 'guest' };

export interface AppContextType {
  user: AppUser;
  hydrated: boolean;
  savedBusinessIds: string[];
  savedPosts: SavedMedia[];
  savedReels: SavedMedia[];
  savedCampaigns: SavedMedia[];
  likedReelIds: string[];
  reservations: Reservation[];
  orders: OrderRequest[];
  notificationsEnabled: boolean;
  toggleSaveBusiness: (id: string) => void;
  toggleSavePost: (m: SavedMedia) => void;
  toggleSaveReel: (m: SavedMedia) => void;
  toggleSaveCampaign: (m: SavedMedia) => void;
  toggleLikeReel: (id: string) => void;
  isSavedPost: (id: string) => boolean;
  isSavedReel: (id: string) => boolean;
  isSavedCampaign: (id: string) => boolean;
  addReservation: (r: Reservation) => void;
  addOrder: (o: OrderRequest) => void;
  setNotificationsEnabled: (v: boolean) => void;
  logout: () => void;
  clearLocalAccountData: () => Promise<void>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { authUser, signOut } = useAuth();

  const [hydrated, setHydrated] = useState(false);
  const [savedBusinessIds, setSavedBusinessIds] = useState<string[]>([]);
  const [savedPosts, setSavedPosts] = useState<SavedMedia[]>([]);
  const [savedReels, setSavedReels] = useState<SavedMedia[]>([]);
  const [savedCampaigns, setSavedCampaigns] = useState<SavedMedia[]>([]);
  const [likedReelIds, setLikedReelIds] = useState<string[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [orders, setOrders] = useState<OrderRequest[]>([]);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);

  // Identity is derived from the real auth session (synced on auth change)
  const user: AppUser = useMemo(
    () =>
      authUser
        ? {
            id: authUser.id,
            name: authUser.username || authUser.email.split('@')[0] || 'Üye',
            type: authUser.role === 'business' ? 'business' : 'user',
            email: authUser.email,
          }
        : GUEST,
    [authUser]
  );

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const d = JSON.parse(raw);
          setSavedBusinessIds(d.savedBusinessIds ?? []);
          setSavedPosts(d.savedPosts ?? []);
          setSavedReels(d.savedReels ?? []);
          setSavedCampaigns(d.savedCampaigns ?? []);
          setLikedReelIds(d.likedReelIds ?? []);
          setReservations(d.reservations ?? []);
          setOrders(d.orders ?? []);
          setNotificationsEnabledState(d.notificationsEnabled ?? true);
        }
      } catch {
        // ignore
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const data = {
      savedBusinessIds,
      savedPosts,
      savedReels,
      savedCampaigns,
      likedReelIds,
      reservations,
      orders,
      notificationsEnabled,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
  }, [
    hydrated,
    savedBusinessIds,
    savedPosts,
    savedReels,
    savedCampaigns,
    likedReelIds,
    reservations,
    orders,
    notificationsEnabled,
  ]);

  const toggleSaveBusiness = useCallback((id: string) => {
    setSavedBusinessIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const toggleSavePost = useCallback((m: SavedMedia) => {
    setSavedPosts((prev) => (prev.some((x) => x.id === m.id) ? prev.filter((x) => x.id !== m.id) : [m, ...prev]));
  }, []);

  const toggleSaveReel = useCallback((m: SavedMedia) => {
    setSavedReels((prev) => (prev.some((x) => x.id === m.id) ? prev.filter((x) => x.id !== m.id) : [m, ...prev]));
  }, []);

  const toggleSaveCampaign = useCallback((m: SavedMedia) => {
    setSavedCampaigns((prev) => (prev.some((x) => x.id === m.id) ? prev.filter((x) => x.id !== m.id) : [m, ...prev]));
  }, []);

  const toggleLikeReel = useCallback((id: string) => {
    setLikedReelIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const isSavedPost = useCallback((id: string) => savedPosts.some((x) => x.id === id), [savedPosts]);
  const isSavedReel = useCallback((id: string) => savedReels.some((x) => x.id === id), [savedReels]);
  const isSavedCampaign = useCallback((id: string) => savedCampaigns.some((x) => x.id === id), [savedCampaigns]);

  const addReservation = useCallback((r: Reservation) => setReservations((prev) => [r, ...prev]), []);
  const addOrder = useCallback((o: OrderRequest) => setOrders((prev) => [o, ...prev]), []);
  const setNotificationsEnabled = useCallback((v: boolean) => setNotificationsEnabledState(v), []);

  const logout = useCallback(() => {
    signOut();
  }, [signOut]);

  const clearLocalAccountData = useCallback(async () => {
    setSavedBusinessIds([]);
    setSavedPosts([]);
    setSavedReels([]);
    setSavedCampaigns([]);
    setLikedReelIds([]);
    setReservations([]);
    setOrders([]);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AppContext.Provider
      value={{
        user,
        hydrated,
        savedBusinessIds,
        savedPosts,
        savedReels,
        savedCampaigns,
        likedReelIds,
        reservations,
        orders,
        notificationsEnabled,
        toggleSaveBusiness,
        toggleSavePost,
        toggleSaveReel,
        toggleSaveCampaign,
        toggleLikeReel,
        isSavedPost,
        isSavedReel,
        isSavedCampaign,
        addReservation,
        addOrder,
        setNotificationsEnabled,
        logout,
        clearLocalAccountData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
