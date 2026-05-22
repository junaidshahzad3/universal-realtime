import { useState, useCallback } from 'react';
import type { UseOptimisticUpdateOptions, UseOptimisticUpdateReturn } from '../types/index.js';

/**
 * Hook for optimistic UI updates with automatic rollback on server error.
 * 
 * @param initialData - The initial state of the data.
 * @param options - Optional callbacks for success and error handling.
 * @returns {UseOptimisticUpdateReturn} Object containing current data, pending state, and update function.
 */
export function useOptimisticUpdate<TData>(
  initialData: TData,
  options?: UseOptimisticUpdateOptions<TData>,
): UseOptimisticUpdateReturn<TData> {
  const [data, setData] = useState<TData>(initialData);
  const [isPending, setIsPending] = useState(false);

  const update = useCallback(
    async (optimisticValue: TData, mutateFn: () => Promise<TData>) => {
      const rollbackValue = data;
      setData(optimisticValue);
      setIsPending(true);

      try {
        const result = await mutateFn();
        setData(result);
        options?.onSuccess?.(result);
      } catch (error) {
        setData(rollbackValue);
        options?.onError?.(error, () => setData(rollbackValue));
      } finally {
        setIsPending(false);
      }
    },
    [data, options]
  );

  return {
    data,
    isPending,
    update,
  };
}
