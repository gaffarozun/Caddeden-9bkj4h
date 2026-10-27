import { useContext } from 'react';
import { AccountAccessContext } from '@/contexts/AccountAccessContext';
export function useAccountAccess() {
 const context = useContext(AccountAccessContext);
 if (!context) throw new Error('useAccountAccess must be used within AccountAccessProvider');
 return context;
}
