import { useContext } from 'react';
import { CafePresenceContext } from '@/contexts/CafePresenceContext';
export function useCafePresence() {
  const value = useContext(CafePresenceContext);
  if (!value) throw new Error('useCafePresence must be used within CafePresenceProvider');
  return value;
}
