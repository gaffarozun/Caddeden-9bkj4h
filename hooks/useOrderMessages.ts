import { useContext } from 'react';
import { OrderMessagesContext } from '@/contexts/OrderMessagesContext';
export function useOrderMessages() {
 const context=useContext(OrderMessagesContext);
 if(!context)throw new Error('useOrderMessages must be used within OrderMessagesProvider');
 return context;
}
