import React, { createContext, ReactNode, useMemo, useState } from 'react';
import { CafeArrivalController, useCafeArrivalController } from '@/hooks/useCafeArrivalController';
interface CafeArrivalState extends CafeArrivalController { setEnabled: (enabled: boolean) => void }
export const CafeArrivalContext = createContext<CafeArrivalState | undefined>(undefined);
export function CafeArrivalProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const arrival = useCafeArrivalController(enabled);
  const value = useMemo(() => ({ ...arrival, setEnabled }), [arrival]);
  return <CafeArrivalContext.Provider value={value}>{children}</CafeArrivalContext.Provider>;
}
