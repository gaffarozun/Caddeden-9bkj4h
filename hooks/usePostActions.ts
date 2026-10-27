import { useCallback, useEffect, useRef, useState } from 'react';
import { useAlert } from '@/template';
import { useApp } from '@/hooks/useApp';
import { sharePost } from '@/services/postShareService';
import { Post } from '@/services/types';

export function usePostActions(post: Post) {
  const { user, isSavedPost, toggleSavePost } = useApp();
  const { showAlert } = useAlert();
  const [sharing, setSharing] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const share = useCallback(async () => {
    if (locked.current) return;
    locked.current = true;
    setSharing(true);
    try {
      const result = await sharePost(post);
      if (mounted.current && result.copied) showAlert('Paylaşım kopyalandı', 'Gönderinin görsel bağlantısını ve işletme bilgisini istediğiniz uygulamaya yapıştırabilirsiniz.');
    } catch (reason) {
      if (mounted.current) showAlert('Paylaşılamadı', reason instanceof Error ? reason.message : 'Paylaşım işlemi açılamadı.');
    } finally {
      locked.current = false;
      if (mounted.current) setSharing(false);
    }
  }, [post, showAlert]);
  const toggleSave = useCallback(() => toggleSavePost({
    id: post.id, businessId: post.businessId, businessName: post.businessName,
    image: post.image, caption: post.caption,
  }), [post, toggleSavePost]);
  return { saved: isSavedPost(post.id), isBusiness: user.type === 'business', sharing, share, toggleSave };
}
