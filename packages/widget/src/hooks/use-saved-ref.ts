import type { RefObject } from "react";
import { useEffect, useRef } from "react";

export const useSavedRef = <T>(value: T): Readonly<RefObject<T>> => {
  const savedRef = useRef<T>(value);

  useEffect(() => {
    savedRef.current = value;
  });

  return savedRef;
};
