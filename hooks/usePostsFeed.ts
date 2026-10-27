import { useMemo, useState } from 'react';
import { useManualFeed } from './useManualFeed';
import { useMediaExpiry } from './useMediaExpiry';
import { POSTS } from '@/services/mockData';
import { loadPostsFeed, filterPostsByMainCategory } from '@/services/postsFeedService';
import { MainCategoryId, getMainCategory } from '@/services/categories';
import { shuffleFeed } from '@/services/feedOrderService';
import { Post } from '@/services/types';

export function usePostsFeed() {
  const feed = useManualFeed<Post>(loadPostsFeed, () => shuffleFeed(POSTS));
  const posts = useMediaExpiry(feed.items);
  const [main, setMain] = useState<MainCategoryId>('yeme_icme');
  const visiblePosts = useMemo(() => filterPostsByMainCategory(posts, main), [posts, main]);
  return { posts: visiblePosts, main, setMain, categoryLabel: getMainCategory(main)?.label ?? '',
    error: feed.error, refreshing: feed.refreshing, refresh: feed.refresh };
}
