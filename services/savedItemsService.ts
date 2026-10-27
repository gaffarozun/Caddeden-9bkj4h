import { fetchBusinessesByIds } from './businessService';
import { Business, SavedMedia } from './types';

export type SavedCategory = 'all' | 'business' | 'post' | 'reel' | 'campaign';
export type SavedContentKind = 'post' | 'reel' | 'campaign';
export type SavedLibraryItem =
  | { key: string; kind: 'business'; business: Business }
  | { key: string; kind: SavedContentKind; media: SavedMedia };

export const savedCategories: { id: SavedCategory; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'business', label: 'İşletmeler' },
  { id: 'post', label: 'Gönderiler' },
  { id: 'reel', label: 'Cadde TV' },
  { id: 'campaign', label: 'Kampanyalar' },
];

export function loadSavedBusinesses(ids: string[]) {
  return fetchBusinessesByIds(ids);
}

export function buildSavedLibrary(businesses: Business[], posts: SavedMedia[], reels: SavedMedia[], campaigns: SavedMedia[]): SavedLibraryItem[] {
  return [
    ...businesses.map(business => ({ key: `business-${business.id}`, kind: 'business' as const, business })),
    ...posts.map(media => ({ key: `post-${media.id}`, kind: 'post' as const, media })),
    ...reels.map(media => ({ key: `reel-${media.id}`, kind: 'reel' as const, media })),
    ...campaigns.map(media => ({ key: `campaign-${media.id}`, kind: 'campaign' as const, media })),
  ];
}
