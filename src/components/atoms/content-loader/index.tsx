import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { ContainerVariants, container } from "./style.css";
import { vars } from "../../../styles";

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
      highlightColor={vars.color.primary}
      baseColor={vars.color.backgroundMuted}
      enableAnimation
    />
  );
};
