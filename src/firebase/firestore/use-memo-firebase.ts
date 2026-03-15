'use client';

import { useRef } from 'react';

/**
 * A hook to stabilize Firebase references (CollectionReference, DocumentReference, Query).
 * It only re-evaluates the factory if the dependencies change, preventing infinite render loops.
 */
export function useMemoFirebase<T>(factory: () => T, deps: any[]): T {
  const ref = useRef<T | null>(null);
  const depsRef = useRef<any[]>([]);

  const changed = deps.length !== depsRef.current.length || deps.some((dep, i) => dep !== depsRef.current[i]);

  if (changed) {
    ref.current = factory();
    depsRef.current = deps;
  }

  return ref.current!;
}
