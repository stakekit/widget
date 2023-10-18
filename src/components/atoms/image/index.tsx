import {
  HTMLProps,
  ReactNode,
  isValidElement,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Box, BoxProps } from "../box";

const failLoadImages = new Set<string>();

export type ImageProps = {
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
  const [loaded, setLoaded] = useState(false);
  const [timeoutFallback, setTimeoutFallback] = useState(false);

  const onLoad: HTMLProps<HTMLImageElement>["onLoad"] = (e) => {
    setLoaded(true);
    imageProps?.onLoad?.(e);
  };

  const onError: HTMLProps<HTMLImageElement>["onError"] = (e) => {
    if (src) {
      failLoadImages.add(src);
    }
    imageProps?.onError?.(e);
  };

  useEffect(() => {
    const id = setTimeout(() => {
      setTimeoutFallback(true);
    }, 200);

    return () => clearTimeout(id);
  }, []);

  const showFallback = useMemo(
    () => timeoutFallback && !loaded && isValidElement(fallback),
    [fallback, loaded, timeoutFallback]
  );

  return (
    <Box
      {...containerProps}
      position="relative"
      display="flex"
      justifyContent="center"
      // alignItems="center"
    >
      {showFallback && <Box position="absolute">{fallback}</Box>}
      {src && !failLoadImages.has(src) && (
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
