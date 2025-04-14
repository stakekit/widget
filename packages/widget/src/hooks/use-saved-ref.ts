import type { RefObject } from "react";
import { useLayoutEffect, useRef } from "react";

export const useSavedRef = <T>(value: T): Readonly<RefObject<T>> => {
  const savedRef = useRef<T>(value);

  useLayoutEffect(() => {
    savedRef.current = value;
  });

  return savedRef;
};
