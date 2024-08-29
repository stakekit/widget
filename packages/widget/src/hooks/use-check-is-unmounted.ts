import { useCallback, useEffect, useRef } from "react";

export const useCheckIsUnmounted = () => {
  const isUnmounted = useRef(false);

  useEffect(() => {
    isUnmounted.current = false;

    return () => {
      isUnmounted.current = true;
    };
  }, []);

  return useCallback(() => isUnmounted.current, []);
};
