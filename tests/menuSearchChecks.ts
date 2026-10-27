// Pure checks; no backend calls. Backend price ordering is covered by the read-only SQL regression.
import { normalizeSearchText, searchNameMatches } from '../services/searchTextService';
import { buildDiscoveryResults } from '../services/discoveryResultsService';
import type { MenuSearchResult } from '../services/menuSearchService';
import type { Business } from '../services/types';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}
export function runMenuSearchChecks(): string {
  assert(normalizeSearchText('  DÖNER  ') === 'doner', 'Turkish case and accents must normalize.');
  assert(normalizeSearchText('SAÇ  ı İ ÇĞÖŞÜ') === 'sac i i cgosu', 'Turkish dotted/dotless I and whitespace must normalize.');
  assert(searchNameMatches('Tavuk Döner', 'doner'), 'ASCII spelling must match Turkish product names.');
  assert(searchNameMatches('Et Döner Dürüm', 'dürüm döner'), 'Every search token must match regardless of order.');
  assert(!searchNameMatches('Tavuk Döner', 'et döner'), 'Nonmatching tokens must not broaden search.');
  assert(!searchNameMatches('Tavuk Döner', '%'), 'Wildcard characters must be literal.');
  assert(searchNameMatches('Saç Kesimi', 'sac kesimi'), 'Service names must be searchable.');
  const product: MenuSearchResult = { id: 'menu-1', name: 'Tavuk Döner', price: 50, businessId: 'business-1', businessName: 'Kampüs', category: 'restoran', rating: 4.5, ratingCount: 2 };
  const products: MenuSearchResult[] = [product, { ...product, id: 'menu-2', name: 'Et Döner', price: 120, businessId: 'business-2', businessName: 'Cadde' }];
  const business: Business = { id: 'business-1', name: 'Kampüs', category: 'restoran', description: '', cover: '', images: [], rating: 4.5, reviewCount: 2, distanceKm: 0, address: '', phone: '', hours: '', isOpen: true, featured: false, hasMenu: true, menu: [], pin: { x: 0, y: 0 } };
  const before = JSON.stringify(products);
  const rows = buildDiscoveryResults([business], products, true);
  const menuRows = rows.filter(row => row.kind === 'menu');
  assert(menuRows.length === 2 && menuRows[0].kind === 'menu' && menuRows[0].item.price === 50, 'Product presentation must preserve server price order.');
  assert(rows.findIndex(row => row.kind === 'business') > rows.findIndex(row => row.kind === 'menu'), 'Product prices must precede business matches.');
  assert(new Set(rows.map(row => row.key)).size === rows.length, 'Product and business keys must not collide.');
  assert(buildDiscoveryResults([business], [], false).every(row => row.kind === 'business'), 'Clearing search must restore normal discovery.');
  assert(buildDiscoveryResults([], [], true).some(row => row.kind === 'menuStatus'), 'Search must retain a loading/error/empty feedback area.');
  assert(JSON.stringify(products) === before, 'Rendering must not mutate products or shuffle prices.');
  return 'passed: Turkish literal matching, service names, price-order presentation, sections, keys, empty search and immutability';
}
