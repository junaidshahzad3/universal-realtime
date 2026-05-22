import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useOptimisticUpdate } from '../../src/hooks/useOptimisticUpdate.js';

function defer<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useOptimisticUpdate', () => {
  it('updates state optimistically and then with success result', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useOptimisticUpdate<number>(0, { onSuccess }));

    const { promise, resolve } = defer<number>();
    const mutateFn = vi.fn().mockReturnValue(promise);

    let p: Promise<void>;
    act(() => {
      p = result.current.update(1, mutateFn);
    });

    // Check optimistic state inside/after act
    expect(result.current.data).toBe(1);
    expect(result.current.isPending).toBe(true);

    // Resolve the mutation function
    await act(async () => {
      resolve(2);
      await p;
    });

    expect(result.current.data).toBe(2);
    expect(result.current.isPending).toBe(false);
    expect(onSuccess).toHaveBeenCalledWith(2);
  });

  it('rolls back state on error', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useOptimisticUpdate<number>(0, { onError }));

    const { promise, reject } = defer<number>();
    const mutateFn = vi.fn().mockReturnValue(promise);

    let p: Promise<void>;
    act(() => {
      p = result.current.update(1, mutateFn);
    });

    // Check optimistic state
    expect(result.current.data).toBe(1);
    expect(result.current.isPending).toBe(true);

    // Reject the mutation function
    const error = new Error('failed');
    await act(async () => {
      reject(error);
      try {
        await p;
      } catch (e) {
        // expect the rejection to be handled by the hook
      }
    });

    expect(result.current.data).toBe(0);
    expect(result.current.isPending).toBe(false);
    expect(onError).toHaveBeenCalledWith(error, expect.any(Function));
  });
});
