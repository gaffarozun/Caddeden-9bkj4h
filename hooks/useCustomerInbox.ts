import { useContext } from 'react';
import { CustomerInboxContext } from '@/contexts/CustomerInboxContext';
export function useCustomerInbox() {
 const context=useContext(CustomerInboxContext);
 if(!context)throw new Error('useCustomerInbox must be used within CustomerInboxProvider');
 return context;
}
