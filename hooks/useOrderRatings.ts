import { useContext } from 'react';
import { OrderRatingsContext } from '@/contexts/OrderRatingsContext';

export function useOrderRatings() {
  const context = useContext(OrderRatingsContext);
  if (!context) throw new Error('useOrderRatings must be used within OrderRatingsProvider');
  return context;
}
