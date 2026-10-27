import { useContext } from 'react';
import { RatingContext } from '@/contexts/RatingContext';
export function useRatings() {
  const context = useContext(RatingContext);
  if (!context) throw new Error('useRatings must be used within RatingProvider');
  return context;
}
