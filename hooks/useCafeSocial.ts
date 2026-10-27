import { useContext, useMemo } from 'react';
import { CafeSocialContext } from '@/contexts/CafeSocialContext';
export function useCafeSocial(localOnly = false) {
 const context = useContext(CafeSocialContext);
 const result = useMemo(() => context && localOnly ? { ...context, incoming: context.incoming.filter(item => item.in_same_venue === true) } : context, [context, localOnly]);
 if (!result) throw new Error('useCafeSocial must be used within CafeSocialProvider');
 return result;
}
