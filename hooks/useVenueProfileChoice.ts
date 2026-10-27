import { useCallback, useEffect } from 'react';
export function useVenueProfileChoice(value: boolean, enabled: boolean, busy: boolean, onChange: (visible: boolean) => void) {
 useEffect(() => { if (!enabled && value && !busy) onChange(false); }, [value, enabled, busy, onChange]);
 const choose = useCallback((visible: boolean) => { if (!busy && (!visible || enabled)) onChange(visible); }, [busy, enabled, onChange]);
 return { visible: enabled && value, choose, showDisabled: busy || !enabled };
}
