import { Box } from "../../../../../../../shared/ui/primitives/box";
import { Arrow } from "../../../../../../../shared/ui/primitives/icons/arrow";
import { GifIcon } from "../../../../../../../shared/ui/primitives/icons/gift";
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
