import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { ContainerVariants, container } from "./style.css";

export const ContentLoaderSquare = ({
  heightPx,
  variant,
}: {
  heightPx: number;
  variant?: ContainerVariants;
}) => {
  return (
    <Skeleton
      className={container(variant)}
      height={heightPx}
      highlightColor="#2B2B2B"
      baseColor="#363636"
      enableAnimation
    />
  );
};
