import { getSupabaseClient } from '@/template';
import { withRequestTimeout } from './requestTimeoutService';
export interface OrderMessage { id:string;user_id:string;order_id:string;business_name:string;status:string;created_at:string;read_at:string|null }
export function orderMessageText(status:string) {
 switch(status) {
  case 'approved':return 'Siparişiniz onaylandı, hazırlanıyor.';
  case 'on_the_way':return 'Siparişiniz yola çıktı.';
  case 'delivered':return 'Siparişiniz teslim edildi.';
  case 'rejected':return 'Siparişiniz işletme tarafından reddedildi.';
  default:return 'Siparişiniz alındı, işletmenin onayı bekleniyor.';
 }
}
export async function fetchOrderMessages(userId:string):Promise<OrderMessage[]> {
 const {data,error}=await withRequestTimeout(getSupabaseClient().from('order_messages').select('*').eq('user_id',userId).is('read_at',null).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(20),'Sipariş mesajları yüklenemedi.');
 if(error)throw new Error(error.message);
 return (data??[]) as OrderMessage[];
}
export async function acknowledgeOrderMessage(message:OrderMessage,userId:string) {
 const {data,error}=await withRequestTimeout(getSupabaseClient().from('order_messages').update({read_at:new Date().toISOString()}).eq('order_id',message.order_id).eq('user_id',userId).lte('created_at',message.created_at).is('read_at',null).select('id'),'Mesaj okundu olarak işaretlenemedi.');
 if(error || !data)throw new Error(error?.message??'Mesaj bulunamadı.');
}
