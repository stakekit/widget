import { useEffect, useRef } from "react";
import { useSavedRef } from "./use-saved-ref";

export const useSyncElementHeight = (
  setCurrentHeight: (height: number) => void
) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const setCurrentHeightRef = useSavedRef(setCurrentHeight);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      setCurrentHeightRef.current(entry.target.clientHeight);
    });

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [setCurrentHeightRef]);

  return { containerRef };
};
