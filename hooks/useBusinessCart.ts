import { useContext } from 'react';
import { BusinessCartContext } from '@/contexts/BusinessCartContext';
export function useBusinessCart() {
  const value = useContext(BusinessCartContext);
  if (!value) throw new Error('useBusinessCart must be used within BusinessCartProvider');
  return value;
}
