import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { vars } from "../../../styles";

export const ContentLoaderSquare = ({
  heightPx,
  variant,
}: {
  heightPx: number;
  variant?: { size?: "regular" | "medium" };
}) => {
  return (
    <Skeleton
      height={heightPx}
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
