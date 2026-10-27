import { useContext } from 'react';
import { UniversityContext } from '@/contexts/UniversityContext';
export function useUniversity() {
  const context = useContext(UniversityContext);
  if (!context) throw new Error('useUniversity must be used within UniversityProvider');
  return context;
}
