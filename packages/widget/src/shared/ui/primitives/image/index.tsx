import clsx from "clsx";
import type { CSSProperties, HTMLProps } from "react";
import { useState } from "react";
import { vars } from "../../../styles/theme/contract.css";
import type { BoxProps } from "../box";
import { Box } from "../box";

type ImageProps = {
  src?: string | undefined;
  fallbackName?: string | undefined;
  wrapperProps?: Omit<BoxProps, "as">;
  imgProps?: Omit<BoxProps, "as" | "src">;
};

export const Image = ({
  src,
  fallbackName,
  wrapperProps,
  imgProps,
}: ImageProps) => {
  const [failedSrc, setFailedSrc] = useState<string>();
  const initial = monogramInitial(fallbackName);
  const showMonogram =
    initial !== undefined && (src === undefined || src === failedSrc);

  const onError: HTMLProps<HTMLImageElement>["onError"] = (e) => {
    setFailedSrc(src);
    imgProps?.onError?.(e);
  };

  return (
    <Box
      {...wrapperProps}
      position="relative"
      display="flex"
      justifyContent="center"
    >
      {showMonogram ? (
        <Monogram
          initial={initial}
          label={imgProps?.alt}
          className={clsx(imgProps?.className)}
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <Box {...imgProps} src={src} as="img" onError={onError} />
      )}
    </Box>
  );
};

/** Upper-cased first character of a display name, used as the image fallback. */
export const monogramInitial = (name?: string) => {
  const [firstCharacter] = Array.from(name?.trim() ?? "");
  return firstCharacter?.toUpperCase();
};

/** Themed round initial badge rendered in place of a missing or broken image. */
export const Monogram = ({
  initial,
  label,
  className,
  style,
}: {
  initial: string;
  label?: string | undefined;
  className?: string;
  style?: CSSProperties;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    role="img"
    aria-label={label ?? initial}
    className={className}
    style={{ display: "block", flexShrink: 0, ...style }}
  >
    <circle
      cx={50}
      cy={50}
      r={49}
      fill={vars.color.backgroundMuted}
      stroke={vars.color.tabBorder}
      strokeWidth={2}
    />
    <text
      x={50}
      y={50}
      fill={vars.color.text}
      fontFamily={vars.font.body}
      fontSize={48}
      fontWeight={700}
      textAnchor="middle"
      dominantBaseline="central"
    >
      {initial}
    </text>
  </svg>
);
