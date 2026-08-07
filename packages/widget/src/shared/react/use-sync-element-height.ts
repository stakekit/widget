import { Array as EArray, Option } from "effect";
import { useEffect, useEffectEvent, useRef } from "react";

export const useSyncElementHeight = (
  setCurrentHeight: (height: number) => void
) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const onHeightChange = useEffectEvent((height: number) =>
    setCurrentHeight(height)
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = EArray.head(entries).pipe(Option.getOrUndefined);

      if (!entry) return;

      onHeightChange(entry.target.clientHeight);
    });

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  return { containerRef };
};
