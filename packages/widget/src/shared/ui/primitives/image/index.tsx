import type { HTMLProps } from "react";
import { useMemo } from "react";
import type { BoxProps } from "../box";
import { Box } from "../box";

type ImageProps = {
  src?: string;
  fallbackName?: string;
  wrapperProps?: Omit<BoxProps, "as">;
  imgProps?: Omit<BoxProps, "as" | "src">;
};

export const Image = ({
  src,
  fallbackName,
  wrapperProps,
  imgProps,
}: ImageProps) => {
  const generatedFallbackSrc = useMemo(
    () => createMonogramImageSrc(fallbackName),
    [fallbackName]
  );

  const onError: HTMLProps<HTMLImageElement>["onError"] = (e) => {
    if (generatedFallbackSrc) {
      e.currentTarget.src = generatedFallbackSrc;
    }
    imgProps?.onError?.(e);
  };

  return (
    <Box
      {...wrapperProps}
      position="relative"
      display="flex"
      justifyContent="center"
    >
      <Box
        {...imgProps}
        src={src ?? generatedFallbackSrc}
        as="img"
        onError={onError}
      />
    </Box>
  );
};

const createMonogramImageSrc = (name?: string) => {
  if (!name) return undefined;

  const [firstCharacter] = Array.from(name.trim());
  if (!firstCharacter) return undefined;

  const initial = escapeForSvg(firstCharacter.toUpperCase());

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="49" fill="#FFFFFF" stroke="rgba(0,0,0,0.08)" stroke-width="2" /><text x="50" y="50" fill="#000000" font-family="Arial, sans-serif" font-size="48" font-weight="700" text-anchor="middle" dominant-baseline="central">${initial}</text></svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const escapeForSvg = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
