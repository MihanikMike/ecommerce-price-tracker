import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

/**
 * Hook to fetch paginated products
 */
export function useProducts(page = 1, limit = 20, site = null) {
  return useQuery({
    queryKey: ['products', { page, limit, site }],
    queryFn: () => api.getProducts({ page, limit, site }),
    staleTime: 60 * 1000, // 1 minute
    placeholderData: (prev) => prev,
  });
}

/**
 * Hook to fetch a single product
 */
export function useProduct(id) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => api.getProduct(id),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook to delete a product
 */
export function useDeleteProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id) => api.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
