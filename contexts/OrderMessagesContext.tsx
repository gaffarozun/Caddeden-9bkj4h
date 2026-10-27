import React,{createContext,ReactNode,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useApp } from '@/hooks/useApp';
import { acknowledgeOrderMessage,fetchOrderMessages,OrderMessage } from '@/services/orderMessageService';
export interface OrderMessagesContextType {current:OrderMessage|null;count:number;busy:boolean;error:string;dismiss:()=>Promise<boolean>;clearDeliveredMessages:(orderId:string,deliveredAt:string)=>void}
export const OrderMessagesContext=createContext<OrderMessagesContextType|undefined>(undefined);
export function OrderMessagesProvider({children}:{children:ReactNode}) {
 const {authUser,passwordRecovery,loading,profileError}=useAuth(); const {notificationsEnabled,hydrated}=useApp();
 const userId=authUser?.role==='user' && authUser.status==='active' && !passwordRecovery && !profileError && !loading ? authUser.id : '';
 const [messages,setMessages]=useState<OrderMessage[]>([]); const [owner,setOwner]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const generation=useRef(0); const lock=useRef(false);const suppressed=useRef(new Set<string>());
 const clearedDeliveries=useRef(new Map<string,string>());
 useEffect(()=>{
  const version=++generation.current;let alive=true;let fetching=false;
  setMessages([]);setOwner(userId);setError('');setBusy(false);suppressed.current=new Set();clearedDeliveries.current=new Map();lock.current=false;
  if(!userId || !notificationsEnabled || !hydrated)return;
  const load=async()=>{
   if(!alive || fetching || (AppState.currentState && AppState.currentState!=='active'))return;
   fetching=true;
   try{const next=await fetchOrderMessages(userId);if(alive && generation.current===version)setMessages(next.filter(item=>!suppressed.current.has(item.id) && Date.parse(item.created_at)>Date.parse(clearedDeliveries.current.get(item.order_id)??'1970-01-01T00:00:00Z')));}
   catch{/* Passive polling errors do not interrupt the current screen; retry next cycle. */}
   finally{fetching=false;}
  };
  void load();const timer=setInterval(()=>{void load();},10000);
  const sub=AppState.addEventListener('change',state=>{if(state==='active')void load();});
  return()=>{alive=false;generation.current++;clearInterval(timer);sub.remove();};
 },[userId,notificationsEnabled,hydrated]);
 const visible=owner===userId && notificationsEnabled && hydrated ? messages : [];
 const current=visible[0]??null;
 const dismiss=useCallback(async()=>{
  if(!current || lock.current)return false;const version=generation.current;lock.current=true;setBusy(true);setError('');
  try{
   await acknowledgeOrderMessage(current,userId);
   if(version!==generation.current)return false;
   for(const item of messages)if(item.order_id===current.order_id && item.created_at<=current.created_at)suppressed.current.add(item.id);
   setMessages(previous=>previous.filter(item=>item.order_id!==current.order_id || item.created_at>current.created_at));return true;
  }catch(reason){if(version===generation.current)setError(reason instanceof Error?reason.message:'Mesaj kapatılamadı.');return false;}
  finally{if(version===generation.current){lock.current=false;setBusy(false);}}
 },[current,userId,messages]);
 // Rating receipts acknowledge delivery messages on the server; suppress in-flight polling snapshots locally too.
 const clearDeliveredMessages=useCallback((orderId:string,deliveredAt:string)=>{
  const previous=clearedDeliveries.current.get(orderId);
  if(!previous || Date.parse(previous)<Date.parse(deliveredAt))clearedDeliveries.current.set(orderId,deliveredAt);
  setMessages(items=>items.filter(item=>item.order_id!==orderId || Date.parse(item.created_at)>Date.parse(deliveredAt)));
 },[]);
 const value=useMemo(()=>({current,count:visible.length,busy,error,dismiss,clearDeliveredMessages}),[current,visible.length,busy,error,dismiss,clearDeliveredMessages]);
 return <OrderMessagesContext.Provider value={value}>{children}</OrderMessagesContext.Provider>;
}
