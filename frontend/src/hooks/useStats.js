import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

/**
 * Hook to fetch system statistics
 */
export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: api.getStats,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refresh every minute
  });
}
