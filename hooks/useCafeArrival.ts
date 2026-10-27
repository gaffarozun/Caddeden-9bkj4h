import { useEffect } from 'react';
import { useCafeArrivalState } from './useCafeArrivalState';

// The root owns overlay gating. Pages consume the same scan and prompt state without creating extra GPS polls.
export function useCafeArrival(enabled: boolean) {
  const arrival = useCafeArrivalState();
  const { setEnabled } = arrival;
  useEffect(() => {
    setEnabled(enabled);
    return () => setEnabled(false);
  }, [enabled, setEnabled]);
  return { ...arrival, cafe: enabled ? arrival.cafe : null };
}
export type CafeArrivalModel = ReturnType<typeof useCafeArrival>;
