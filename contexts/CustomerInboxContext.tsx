import { createContext, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useCafeSocial } from '@/hooks/useCafeSocial';
import { useOrderMessages } from '@/hooks/useOrderMessages';
import { CustomerNotification, fetchCustomerInbox, readCustomerNotification } from '@/services/customerInboxService';
export interface CustomerInboxState { items: CustomerNotification[]; unread: number; loading: boolean; busy: boolean; error: string; refresh: () => Promise<void>; read: (id: string) => Promise<boolean>; dismissBubble: (id: string) => void; socialBubble: CustomerNotification | null }
export const CustomerInboxContext = createContext<CustomerInboxState | undefined>(undefined);
export function CustomerInboxProvider({children}: {children: ReactNode}) {
 const {authUser,loading: authLoading,passwordRecovery,profileError}=useAuth();
 const social=useCafeSocial(); const orders=useOrderMessages();
 const uid=!authLoading && !passwordRecovery && !profileError && authUser?.role==='user' && authUser.status==='active' ? authUser.id : '';
 const [items,setItems]=useState<CustomerNotification[]>([]); const [owner,setOwner]=useState(''); const [loading,setLoading]=useState(false); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
 const [dismissed,setDismissed]=useState<string[]>([]); const epoch=useRef(0); const fetching=useRef(false); const locking=useRef(false); const readIds=useRef(new Map<string,string>());
 const refresh=useCallback(async()=>{
  if(!uid || fetching.current)return;
  const version=epoch.current; fetching.current=true;
  try {const next=await fetchCustomerInbox(); if(version===epoch.current){setItems(next.map(item=>readIds.current.has(item.id)?{...item,read_at:readIds.current.get(item.id)!}:item)); setError('');}}
  catch(reason){if(version===epoch.current)setError(reason instanceof Error?reason.message:'Bildirimler yüklenemedi.');}
  finally{if(version===epoch.current){fetching.current=false;setLoading(false);}}
 },[uid]);
 useEffect(()=>{
  epoch.current++; fetching.current=false; locking.current=false; readIds.current.clear(); setOwner(uid);setItems([]);setDismissed([]);setError('');setBusy(false);setLoading(!!uid);
  if(!uid)return;
  void refresh(); const timer=setInterval(()=>{if(AppState.currentState!=='background' && AppState.currentState!=='inactive')void refresh();},10000);
  const sub=AppState.addEventListener('change',state=>{if(state==='active')void refresh();});
  return()=>{epoch.current++;clearInterval(timer);sub.remove();};
 },[uid,refresh]);
 useEffect(()=>{void refresh();},[social.revision,orders.current?.id,orders.count,refresh]);
 const read=useCallback(async(id:string)=>{
  if(!uid || locking.current)return false;
  const version=epoch.current;locking.current=true;setBusy(true);setError('');
  try{await readCustomerNotification(id);if(version!==epoch.current)return false;const date=new Date().toISOString();readIds.current.set(id,date);setItems(prev=>prev.map(item=>item.id===id?{...item,read_at:date}:item));return true;}
  catch(reason){if(version===epoch.current)setError(reason instanceof Error?reason.message:'Bildirim okunamadı.');return false;}
  finally{if(version===epoch.current){locking.current=false;setBusy(false);}}
 },[uid]);
 const dismissBubble=useCallback((id:string)=>setDismissed(prev=>prev.includes(id)?prev:[...prev,id]),[]);
 const current=owner===uid && !!uid ? items : [];
 const value=useMemo<CustomerInboxState>(()=>({items:current,unread:current.filter(item=>!item.read_at).length,loading,busy,error,refresh,read,dismissBubble,socialBubble:current.find(item=>item.kind!=='order' && !item.read_at && !dismissed.includes(item.id))??null}),[current,loading,busy,error,refresh,read,dismissBubble,dismissed]);
 return <CustomerInboxContext.Provider value={value}>{children}</CustomerInboxContext.Provider>;
}
