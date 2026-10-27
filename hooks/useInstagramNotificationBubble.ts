import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useCustomerInbox } from './useCustomerInbox';
export function useInstagramNotificationBubble(){
 const inbox=useCustomerInbox();const router=useRouter();const current=inbox.socialBubble;
 const open=useCallback(()=>{if(!current)return;inbox.dismissBubble(current.id);router.push('/notifications');},[current,inbox.dismissBubble,router]);
 const dismiss=useCallback(()=>{if(current)inbox.dismissBubble(current.id);},[current,inbox.dismissBubble]);
 return {current,open,dismiss};
}
