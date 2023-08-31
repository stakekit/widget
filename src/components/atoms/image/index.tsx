import {
  HTMLProps,
  ReactNode,
  isValidElement,
  useEffect,
  useState,
} from "react";
import { BoxProps } from "../box";
import { Box } from "../box";

const failLoadImages = new Set<string>();

export type ImageProps = Omit<BoxProps, "as"> & {
  fallback?: string | ReactNode;
  retryOnFail?: boolean;
};

export const Image = ({ fallback, retryOnFail, ...props }: ImageProps) => {
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    setIsError(false);
  }, [props.src]);

  const onError: HTMLProps<HTMLImageElement>["onError"] = (e) => {
    setIsError(true);
    if (props.src) {
      failLoadImages.add(props.src);
    }
    props.onError?.(e);
  };

  if (
    (isError ||
      !props.src ||
      (failLoadImages.has(props.src) && !retryOnFail)) &&
    isValidElement(fallback)
  ) {
    return fallback;
  }

  return <Box {...props} as="img" onError={onError} />;
};
