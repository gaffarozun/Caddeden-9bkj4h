import { Business } from './types';
export type DiscoveryRatingSort = 'recommended' | 'highest' | 'nearest';
export const discoveryRatingSorts = [
  { id: 'recommended', label: 'Önerilen' },
  { id: 'highest', label: 'En yüksek puan' },
  { id: 'nearest', label: 'En yakın' },
] as const;
export function sortDiscoveryBusinesses(items: Business[], sort: DiscoveryRatingSort): Business[] {
  // Recommended consumes the viewer's already shuffled discovery list without open/creation/name priority.
  if (sort !== 'highest') return [...items];
  return [...items].sort((first, second) => {
    // Demo scores are not user votes. Rated real businesses lead; unrated ones follow; demos are last.
    const tier = (item: Business) => /^[0-9a-f-]{36}$/i.test(item.id) ? item.reviewCount > 0 ? 0 : 1 : 2;
    const rankDifference = tier(first) - tier(second);
    if (rankDifference) return rankDifference;
    if (tier(first) === 0) {
      const ratingDifference = second.rating - first.rating;
      if (ratingDifference) return ratingDifference;
      if (second.reviewCount !== first.reviewCount) return second.reviewCount - first.reviewCount;
    }
    return first.name.localeCompare(second.name, 'tr');
  });
}
