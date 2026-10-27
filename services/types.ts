// Powered by OnSpace.AI
export type CategoryId =
  | 'restoran'
  | 'kafe'
  | 'market'
  | 'eglence'
  | 'kadin_kuafor'
  | 'erkek_kuafor'
  | 'guzellik'
  // legacy ids (still resolved via normalizeCategory)
  | 'bar'
  | 'club'
  | 'berber'
  | 'guzellik_salonu'
  | 'protez_tirnak'
  | 'cilt_bakimi'
  | 'kas_kirpik'
  | 'makyaj'
  | 'agda_epilasyon';

export interface Category {
  id: CategoryId;
  label: string;
  icon: string; // MaterialCommunityIcons name
  color: string;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description?: string;
  durationMin?: number;
  tag?: string;
  image?: string;
  group?: string;
}

export interface Business {
  id: string;
  name: string;
  category: CategoryId;
  description: string;
  cover: string;
  logo?: string;
  mapsUrl?: string;
  menuCover?: string;
  menuGroupCovers?: Record<string, string>;
  profileTags?: string[];
  lat?: number;
  lng?: number;
  images: string[];
  rating: number;
  reviewCount: number;
  distanceKm: number;
  distanceMeasured?: boolean;
  address: string;
  phone: string;
  hours: string;
  openTime?: string;
  closeTime?: string;
  openDays?: number[];
  statusMode?: 'auto' | 'manual';
  avgDeliveryMinutes?: number;
  isOpen: boolean;
  featured: boolean;
  campaign?: string;
  hasMenu: boolean;
  allowMenu?: boolean;
  allowReservation?: boolean;
  allowOrder?: boolean;
  minOrder?: number;
  menu: MenuItem[];
  pin: { x: number; y: number };
}

export interface Reel {
  id: string;
  businessId: string;
  businessName: string;
  category: CategoryId;
  image: string;
  caption: string;
  likes: number;
  sponsored: boolean;
}

export interface Post {
  id: string;
  businessId: string;
  businessName: string;
  category: CategoryId;
  image: string;
  caption: string;
  campaign?: string;
  likes: number;
  sponsored: boolean;
  timeAgo: string;
  expiresAt?: number;
}

export interface SavedMedia {
  id: string;
  businessId: string;
  businessName: string;
  image: string;
  caption: string;
}

export interface Reservation {
  id: string;
  businessId: string;
  businessName: string;
  date: string;
  time: string;
  guests: number;
  status: 'bekliyor' | 'onaylandi' | 'reddedildi';
  createdAt: number;
}

export interface OrderRequest {
  id: string;
  businessId: string;
  businessName: string;
  note: string;
  status: 'bekliyor' | 'kabul' | 'red';
  createdAt: number;
}

export type UserType = 'guest' | 'user' | 'business';

export interface AppUser {
  id: string;
  name: string;
  type: UserType;
  email?: string;
}
