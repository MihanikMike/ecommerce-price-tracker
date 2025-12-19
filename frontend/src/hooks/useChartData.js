import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

/**
 * Hook to fetch chart data for a product
 */
export function useChartData(id, range = '30d') {
  return useQuery({
    queryKey: ['chartData', id, range],
    queryFn: () => api.getChartData(id, range),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
