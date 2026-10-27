import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
export function useCafeAccountPanel() {
  const { authUser } = useAuth();
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { setExpanded(false); }, [authUser?.id]);
  const toggle = useCallback(() => setExpanded(value => !value), []);
  return { expanded, toggle, customer: authUser?.role === 'user' };
}
