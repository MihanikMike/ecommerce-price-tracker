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
 * Hook to add a tracked product
 */
export function useAddTracked() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => api.addTracked(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracked'] });
    },
  });
}

/**
 * Hook to update a tracked product
 */
export function useUpdateTracked() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }) => api.updateTracked(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracked'] });
    },
  });
}

/**
 * Hook to delete a tracked product
 */
export function useDeleteTracked() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id) => api.deleteTracked(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracked'] });
    },
  });
}
