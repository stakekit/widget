import type { MutableRefObject } from "react";
import { useEffect, useRef } from "react";

export const useSavedRef = <T>(value: T): Readonly<MutableRefObject<T>> => {
  const savedRef = useRef<T>(value);

  useEffect(() => {
    savedRef.current = value;
  });

  return savedRef;
};
