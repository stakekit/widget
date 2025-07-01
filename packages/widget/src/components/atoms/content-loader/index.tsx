import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import type { ComponentProps } from "react";
import { vars } from "../../../styles/theme/contract.css";

export const ContentLoaderSquare = ({
  heightPx,
  variant,
  containerClassName,
}: {
  heightPx: number;
  variant?: { size?: "regular" | "medium" };
  containerClassName?: ComponentProps<typeof Skeleton>["containerClassName"];
}) => {
  return (
    <Skeleton
      height={heightPx}
      containerClassName={containerClassName}
      baseColor={vars.color.skeletonLoaderBase}
      highlightColor={vars.color.skeletonLoaderHighlight}
      enableAnimation
      borderRadius={
        variant?.size === "medium"
          ? vars.borderRadius.baseContract.md
          : vars.borderRadius.baseContract.xl
      }
    />
  );
};
