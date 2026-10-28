import { RefObject, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

const THRESHOLD = 64;   // bırakınca yenilemeyi başlatan çekme mesafesi (px)
const MAX_PULL = 96;
const WHEEL_TRIGGER = 160;

interface ScrollRef { getScrollableNode?: () => unknown }

// Web'de RefreshControl çalışmaz. Liste en üstteyken parmakla (dokunmatik) ya da fare/izleme dörtgeniyle
// yukarı kaydırma hareketini ("aşağı çekme") yakalar ve yenilemeyi başlatır. Native'de hiçbir şey yapmaz.
export function useWebPullRefresh(listRef: RefObject<ScrollRef | null>, onRefresh: () => void, refreshing: boolean) {
  const [pull, setPull] = useState(0);
  const latest = useRef({ onRefresh, refreshing });
  latest.current = { onRefresh, refreshing };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = listRef.current?.getScrollableNode?.() as HTMLElement | undefined;
    if (!node || typeof node.addEventListener !== 'function') return;
    let startY = 0, tracking = false, current = 0, wheelAcc = 0;
    let wheelTimer: ReturnType<typeof setTimeout> | null = null;
    const previous = node.style.overscrollBehaviorY;
    node.style.overscrollBehaviorY = 'contain';
    const fire = () => { if (!latest.current.refreshing) latest.current.onRefresh(); };
    const set = (v: number) => { current = v; setPull(v); };

    const onStart = (e: TouchEvent) => { if (node.scrollTop <= 0 && e.touches.length === 1) { startY = e.touches[0].clientY; tracking = true; } };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0 && node.scrollTop <= 0) { if (e.cancelable) e.preventDefault(); set(Math.min(dy * 0.5, MAX_PULL)); }
      else if (current !== 0) set(0);
    };
    const onEnd = () => { if (!tracking) return; tracking = false; if (current >= THRESHOLD) fire(); set(0); };
    const onWheel = (e: WheelEvent) => {
      if (node.scrollTop > 0 || e.deltaY >= 0) { wheelAcc = 0; if (current !== 0) set(0); return; }
      wheelAcc += -e.deltaY;
      set(Math.min(wheelAcc * 0.4, MAX_PULL));
      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => { wheelAcc = 0; set(0); }, 250);
      if (wheelAcc >= WHEEL_TRIGGER) { wheelAcc = 0; set(0); fire(); }
    };
    node.addEventListener('touchstart', onStart, { passive: true });
    node.addEventListener('touchmove', onMove, { passive: false });
    node.addEventListener('touchend', onEnd, { passive: true });
    node.addEventListener('touchcancel', onEnd, { passive: true });
    node.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      node.removeEventListener('touchstart', onStart);
      node.removeEventListener('touchmove', onMove);
      node.removeEventListener('touchend', onEnd);
      node.removeEventListener('touchcancel', onEnd);
      node.removeEventListener('wheel', onWheel);
      if (wheelTimer) clearTimeout(wheelTimer);
      node.style.overscrollBehaviorY = previous;
    };
  }, [listRef]);

  return pull;
}
