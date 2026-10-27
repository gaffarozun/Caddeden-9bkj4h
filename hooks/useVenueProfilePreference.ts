import { useCafePresence } from './useCafePresence';
export function useVenueProfilePreference() {
 const presence = useCafePresence();
 return { visible: presence.profileEnabled, ready: presence.profilePreferenceReady, busy: presence.busy, error: presence.error, setVisible: presence.setProfileEnabled };
}
