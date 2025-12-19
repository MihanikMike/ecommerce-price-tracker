import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

/**
 * Hook to fetch price changes
 */
export function usePriceChanges(hours = 24, minDrop = 0, limit = 50) {
  return useQuery({
    queryKey: ['priceChanges', { hours, minDrop, limit }],
    queryFn: () => api.getPriceChanges({ hours, minDrop, limit }),
    staleTime: 60 * 1000,
  });
}
