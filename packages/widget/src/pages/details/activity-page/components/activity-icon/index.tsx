import { Box } from "../../../../../components/atoms/box";
import { Arrow } from "../../../../../components/atoms/icons/arrow";
import { GifIcon } from "../../../../../components/atoms/icons/gift";
import { iconCircle } from "../activity-item.css";

export type ActivityIconType = "in" | "out" | "rewards";

export const ActivityIcon = ({ type }: { type: ActivityIconType }) => (
  <Box className={iconCircle}>
    {type === "rewards" ? (
      <GifIcon />
    ) : type === "out" ? (
      <Arrow direction="down" />
    ) : (
      <Arrow direction="up" />
    )}
  </Box>
);
