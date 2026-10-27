import type { Business } from './types';
import type { MenuSearchResult } from './menuSearchService';

export type DiscoveryResultRow =
  | { kind: 'menuHeader' | 'menuStatus' | 'businessHeader'; key: string }
  | { kind: 'menu'; key: string; item: MenuSearchResult }
  | { kind: 'business'; key: string; business: Business };

export function buildDiscoveryResults(businesses: Business[], products: MenuSearchResult[], searching: boolean): DiscoveryResultRow[] {
  const businessRows: DiscoveryResultRow[] = businesses.map(business => ({ kind: 'business', key: `business:${business.id}`, business }));
  if (!searching) return businessRows;
  return [
    { kind: 'menuHeader', key: 'menuHeader' },
    ...products.map((item): DiscoveryResultRow => ({ kind: 'menu', key: `menu:${item.id}`, item })),
    { kind: 'menuStatus', key: 'menuStatus' },
    ...(businessRows.length ? [{ kind: 'businessHeader' as const, key: 'businessHeader' }, ...businessRows] : []),
  ];
}
