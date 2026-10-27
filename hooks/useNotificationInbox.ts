import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCustomerInbox } from './useCustomerInbox';
import { CustomerNotification } from '@/services/customerInboxService';
export function useNotificationInbox(){
 const inbox=useCustomerInbox();const router=useRouter();const [selected,setSelected]=useState('');
 useFocusEffect(useCallback(()=>{void inbox.refresh();},[inbox.refresh]));
 const select=useCallback(async(item:CustomerNotification)=>{setSelected(previous=>previous===item.id?'':item.id);if(!item.read_at)await inbox.read(item.id);},[inbox.read]);
 const openDestination=useCallback((item:CustomerNotification)=>{if(item.kind==='order')router.push({pathname:'/history',params:{scope:'orders',mode:'all'}});else if(item.business_id)router.push(`/business/${item.business_id}`);else router.push('/(tabs)/profile');},[router]);
 return {...inbox,selected,select,openDestination};
}
