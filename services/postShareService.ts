import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Post } from '@/services/types';

export function postShareMessage(post: Post): string {
  return [post.businessName, post.caption.trim(), post.image, `onspaceapp://business/${post.businessId}`].filter(Boolean).join('\n');
}

export async function sharePost(post: Post): Promise<{ copied: boolean }> {
  const message = postShareMessage(post);
  // React Native Web has no native Share implementation; provide a usable copy action.
  if (Platform.OS === 'web') {
    const copied = await Clipboard.setStringAsync(message);
    if (!copied) throw new Error('Paylaşım bağlantısı kopyalanamadı.');
    return { copied: true };
  }
  await Share.share({ title: `${post.businessName} · Caddeden`, message });
  return { copied: false };
}
