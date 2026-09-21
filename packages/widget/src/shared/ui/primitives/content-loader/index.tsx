import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { vars } from "../../../styles/theme/contract.css";
import { fillContainer } from "./styles.css";

export const ContentLoaderSquare = ({ heightPx }: { heightPx?: number }) => {
  return (
    <Skeleton
      height={heightPx ?? "100%"}
      inline={heightPx === undefined}
      containerClassName={heightPx === undefined ? fillContainer : undefined}
      baseColor={vars.color.skeletonLoaderBase}
      highlightColor={vars.color.skeletonLoaderHighlight}
      enableAnimation
      borderRadius={vars.borderRadius.baseContract.xl}
    />
  );
};

export const ContentLoaderLine = ({
  widthPx,
}: {
  widthPx?: number | string;
}) => {
  return (
    <Skeleton
      width={widthPx}
      inline
      baseColor={vars.color.skeletonLoaderBase}
      highlightColor={vars.color.skeletonLoaderHighlight}
      enableAnimation
      borderRadius={vars.borderRadius.baseContract.md}
    />
  );
};

export const ContentLoaderCircle = () => {
  return (
    <Skeleton
      circle
      height="100%"
      width="100%"
      inline
      containerClassName={fillContainer}
      baseColor={vars.color.skeletonLoaderBase}
      highlightColor={vars.color.skeletonLoaderHighlight}
      enableAnimation
    />
  );
};
