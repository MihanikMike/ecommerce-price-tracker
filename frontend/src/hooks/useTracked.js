import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

/**
 * Hook to fetch paginated tracked products
 */
export function useTracked(page = 1, limit = 20, mode = null, enabled = null) {
  return useQuery({
    queryKey: ['tracked', { page, limit, mode, enabled }],
    queryFn: () => api.getTracked({ page, limit, mode, enabled }),
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  });
}

/**
 * Hook to add a tracked product with optional callbacks for toast notifications
 */
export function useAddTracked(options = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;
  
  return useMutation({
    mutationFn: (data) => api.addTracked(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tracked'] });
      onSuccess?.(data);
    },
    onError: (error) => {
      onError?.(error);
    },
  });
}

/**
 * Hook to update a tracked product with optional callbacks for toast notifications
 */
export function useUpdateTracked(options = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;
  
  return useMutation({
    mutationFn: ({ id, data }) => api.updateTracked(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tracked'] });
      onSuccess?.(data);
    },
    onError: (error) => {
      onError?.(error);
    },
  });
}

/**
 * Hook to delete a tracked product with optional callbacks for toast notifications
 */
export function useDeleteTracked(options = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;
  
  return useMutation({
    mutationFn: (id) => api.deleteTracked(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tracked'] });
      onSuccess?.(data);
    },
    onError: (error) => {
      onError?.(error);
    },
  });
}

