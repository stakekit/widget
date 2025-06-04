import type { HTMLProps, ReactNode } from "react";
import { isValidElement, useEffect, useMemo, useState } from "react";
import type { BoxProps } from "../box";
import { Box } from "../box";

const failLoadImages = new Set<string>();

type ImageProps = {
  src: string | undefined;
  fallback: string | ReactNode;
  containerProps?: Omit<BoxProps, "as">;
  imageProps?: Omit<BoxProps, "as" | "src">;
};

export const Image = ({
  fallback,
  src,
  containerProps,
  imageProps,
}: ImageProps) => {
  const [loadState, setLoadState] = useState(() => ({
    src,
    loaded: false,
    timeoutFallback: false,
  }));

  /**
   * Reset on src change
   */
  if (loadState.src !== src) {
    setLoadState({ src, loaded: false, timeoutFallback: false });
  }

  useEffect(() => {
    if (src && failLoadImages.has(src)) return;

    const id = setTimeout(() => {
      setLoadState((prev) => ({ ...prev, timeoutFallback: true }));
    }, 500);

    return () => clearTimeout(id);
  }, [src]);

  const onLoad: HTMLProps<HTMLImageElement>["onLoad"] = (e) => {
    setLoadState((prev) => ({ ...prev, loaded: true }));
    imageProps?.onLoad?.(e);
  };

  const onError: HTMLProps<HTMLImageElement>["onError"] = (e) => {
    if (src) {
      failLoadImages.add(src);
    }
    imageProps?.onError?.(e);
  };

  const showFallback = useMemo(
    () =>
      ((src && failLoadImages.has(src)) ||
        (loadState.timeoutFallback && !loadState.loaded)) &&
      isValidElement(fallback),
    [fallback, loadState.loaded, loadState.timeoutFallback, src]
  );

  return (
    <Box
      {...containerProps}
      position="relative"
      display="flex"
      justifyContent="center"
    >
      {showFallback && <Box position="absolute">{fallback}</Box>}
      {!!(src && !failLoadImages.has(src)) && (
        <Box
          {...imageProps}
          src={src}
          as="img"
          onLoad={onLoad}
          onError={onError}
        />
      )}
    </Box>
  );
};
