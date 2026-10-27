// Powered by OnSpace.AI
import { useContext } from 'react';
import { AppContext, AppContextType } from '@/contexts/AppContext';

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
