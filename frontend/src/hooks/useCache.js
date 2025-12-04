import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

/**
 * Hook to fetch and manage cache stats with optional callbacks for toast notifications
 */
export function useCache(options = {}) {
  const queryClient = useQueryClient();
  const { onClearSuccess, onClearError } = options;

  const query = useQuery({
    queryKey: ['cacheStats'],
    queryFn: api.getCacheStats,
    staleTime: 30 * 1000,
  });

  const clearMutation = useMutation({
    mutationFn: api.clearCache,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cacheStats'] });
      onClearSuccess?.(data);
    },
    onError: (error) => {
      onClearError?.(error);
    },
  });

  return {
    ...query,
    clearCache: clearMutation.mutate,
    isClearing: clearMutation.isPending,
  };
}

