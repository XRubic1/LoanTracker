import { createContext, useContext } from 'react';
import type { MotusAutoCheckData } from '@/lib/motusAutoCheck';

export interface MotusAutoCheckValue {
  userId: string;
  data: MotusAutoCheckData;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  onRefreshInsurance?: () => void;
}

export const MotusAutoCheckContext = createContext<MotusAutoCheckValue | null>(null);

export function useMotusAutoCheckContext(): MotusAutoCheckValue | null {
  return useContext(MotusAutoCheckContext);
}
