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

export type ImageProps = Omit<BoxProps, "as"> & {
  fallback: string | ReactNode;
  src: string | undefined;
};

export const Image = ({ fallback, ...props }: ImageProps) => {
  const [loaded, setLoaded] = useState(false);
  const [timeoutFallback, setTimeoutFallback] = useState(false);

  const onLoad: HTMLProps<HTMLImageElement>["onLoad"] = (e) => {
    setLoaded(true);
    props.onLoad?.(e);
  };

  const onError: HTMLProps<HTMLImageElement>["onError"] = (e) => {
    if (props.src) {
      failLoadImages.add(props.src);
    }
    props.onError?.(e);
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
    <Box hw={props.hw} position="relative" display="flex">
      {showFallback && <Box position="absolute">{fallback}</Box>}
      {props.src && !failLoadImages.has(props.src) && (
        <Box {...props} as="img" onLoad={onLoad} onError={onError} />
      )}
    </Box>
  );
};
