import { useContext } from 'react';
import { CafeArrivalContext } from '@/contexts/CafeArrivalContext';
export function useCafeArrivalState() {
  const context = useContext(CafeArrivalContext);
  if (!context) throw new Error('useCafeArrivalState must be used within CafeArrivalProvider');
  return context;
}
