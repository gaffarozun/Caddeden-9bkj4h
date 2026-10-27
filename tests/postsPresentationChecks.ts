// Run in an Expo-compatible TypeScript test environment; these checks do not access the backend or open sharing.
import { filterPostsByMainCategory } from '../services/postsFeedService';
import { postShareMessage } from '../services/postShareService';
import { Post } from '../services/types';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function runPostsPresentationChecks(): string {
  const base: Post = {
    id: 'food', businessId: 'business-1', businessName: 'Kampüs Kafe', category: 'kafe',
    image: 'https://example.com/photo.jpg', caption: 'Günün duyurusu', likes: 4,
    sponsored: true, timeAgo: 'şimdi',
  };
  const source: Post[] = [
    { ...base, id: 'beauty', category: 'guzellik' },
    base,
    { ...base, id: 'entertainment', category: 'bar' },
    { ...base, id: 'hair', category: 'berber' },
  ];
  const before = JSON.stringify(source);
  const food = filterPostsByMainCategory(source, 'yeme_icme');
  const beauty = filterPostsByMainCategory(source, 'guzellik_bakim');
  assert(food.map(item => item.id).join(',') === 'food,entertainment', 'Food and entertainment must share one category, preserving random order.');
  assert(beauty.map(item => item.id).join(',') === 'beauty,hair', 'Beauty and legacy hairdresser categories must be selectable together.');
  assert(food.length + beauty.length === source.length, 'Category switching must preserve all recognized posts.');
  assert(JSON.stringify(source) === before, 'Filtering must not mutate posts or alter sponsorship metadata.');
  assert(filterPostsByMainCategory([], 'guzellik_bakim').length === 0, 'Empty categories must be safe.');
  const message = postShareMessage(base);
  assert(message.includes(base.businessName) && message.includes(base.caption), 'Sharing must include business and caption.');
  assert(message.includes(base.image), 'Sharing must include the actual image URL.');
  assert(message.includes(`onspaceapp://business/${base.businessId}`), 'Sharing must link to the corresponding business profile.');
  assert(!postShareMessage({ ...base, caption: '' }).includes('\n\n'), 'Empty captions must not create blank sections.');
  return 'passed: category filtering, legacy mapping, stable order, immutability and share content';
}
