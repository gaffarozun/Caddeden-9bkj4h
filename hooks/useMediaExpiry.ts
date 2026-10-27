import { useEffect,useMemo,useState } from 'react';
import { AppState } from 'react-native';
// Safety-only pruning. Never refetch or shuffle the viewer's manually refreshed feed.
export function useMediaExpiry<T extends {expiresAt?:number}>(items:T[]):T[] {
 const [now,setNow]=useState(Date.now);
 const next=useMemo(()=>Math.min(...items.map(item=>item.expiresAt??Infinity).filter(expiry=>expiry>now)),[items,now]);
 useEffect(()=>{
  const update=()=>setNow(Date.now());
  const timer=Number.isFinite(next)?setTimeout(update,Math.max(1,Math.min(next-Date.now(),60000))):undefined;
  const sub=AppState.addEventListener('change',state=>{if(state==='active')update();});
  return()=>{if(timer!==undefined)clearTimeout(timer);sub.remove();};
 },[next,now]);
 return useMemo(()=>items.filter(item=>!item.expiresAt||item.expiresAt>now),[items,now]);
}
