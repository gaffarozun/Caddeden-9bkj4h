import { useCallback, useEffect, useState } from 'react';
import { isVenueParticipationAvailable } from '@/services/cafePresenceService';
import { useCafeRoom } from './useCafeRoom';
import { useAuth } from './useAuth';
import { useVenueProfileChoice } from './useVenueProfileChoice';
export function useCafeParticipation(businessId: string, manage = false) {
 const m = useCafeRoom(businessId, manage); const { authUser } = useAuth();
 const [choice, setChoice] = useState(false); const [expanded, setExpanded] = useState(false);
 const active = m.local;
 // A global privacy change immediately canonicalizes the per-entry choice to hidden.
 const visibility = useVenueProfileChoice(choice, !!m.room?.enabled && m.presence.profileEnabled, m.presence.busy, setChoice);
 useEffect(() => { setChoice(false); setExpanded(false); }, [businessId, authUser?.id]);
 useEffect(() => { setChoice(false); if (active) setExpanded(true); }, [active]);
 const toggleExpanded = useCallback(() => setExpanded(value => !value), []);
 const join = useCallback(async () => {
  if (await m.presence.join(businessId, visibility.visible)) setChoice(false);
 }, [businessId, visibility.visible, m.presence.join]);
 return { ...m, available: isVenueParticipationAvailable(m.room, manage), active, choice: visibility.visible,
  expanded, toggleExpanded, choose: visibility.choose, join, signedIn: !!authUser,
  customer: authUser?.role === 'user' && authUser.status === 'active' };
}
