import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

/**
 * Hook to fetch and manage cache stats
 */
export function useCache() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['cacheStats'],
    queryFn: api.getCacheStats,
    staleTime: 30 * 1000,
  });

  const clearMutation = useMutation({
    mutationFn: api.clearCache,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cacheStats'] });
    },
  });

  return {
    ...query,
    clearCache: clearMutation.mutate,
    isClearing: clearMutation.isPending,
  };
}
