import { useEffect, useRef } from "react";

export const usePrevious = <T>(value: T) => {
  const lastRef = useRef<T | null>(null);
  const currentRef = useRef<T | null>(null);

  useEffect(() => {
    lastRef.current = currentRef.current;
    currentRef.current = value;
  }, [value]);

  return value === currentRef.current ? lastRef.current : currentRef.current;
};
