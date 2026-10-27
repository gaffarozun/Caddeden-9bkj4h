import { listFeed, timeAgo } from '@/services/contentService';
import { mediaExpiresAt } from './mediaPublicationService';
import { POSTS } from '@/services/mockData';
import { CategoryId, Post } from '@/services/types';
import { MainCategoryId, mainCategoryOf } from '@/services/categories';

// Category changes only filter the viewer's shuffled order; never re-sort it.
export function filterPostsByMainCategory(posts: Post[], main: MainCategoryId): Post[] {
  return posts.filter(post => mainCategoryOf(post.category) === main);
}

export async function loadPostsFeed(): Promise<Post[]> {
  const result = await fetchPublicPosts();
  if (result.error) throw new Error(result.error);
  return result.data;
}

export async function fetchPublicPosts(): Promise<{ data: Post[]; error: string | null }> {
  const { data, error } = await listFeed('post');
  if (error) return { data: [], error };
  const real: Post[] = data.map(item => ({
    id: item.id, businessId: item.business_id, businessName: item.businesses?.name ?? 'İşletme',
    category: (item.businesses?.category as CategoryId) ?? 'restoran', image: item.image_url,
    caption: item.caption ?? '', likes: 0, sponsored: false, timeAgo: timeAgo(item.created_at), expiresAt: mediaExpiresAt(item.end_date),
  }));
  // Preserve existing demo content without giving it a separate/fixed display priority.
  const byId = new Map(real.map(item => [item.id, item]));
  for (const item of POSTS) if (!byId.has(item.id)) byId.set(item.id, item);
  return { data: Array.from(byId.values()), error: null };
}
