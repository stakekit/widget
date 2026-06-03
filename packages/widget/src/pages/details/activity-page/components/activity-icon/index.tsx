import { Box } from "../../../../../components/atoms/box";
import { ArrowDownIcon } from "../../../../../components/atoms/icons/arrow-down";
import { ArrowUpIcon } from "../../../../../components/atoms/icons/arrow-up";
import { GifIcon } from "../../../../../components/atoms/icons/gift";
import { iconCircle } from "../activity-item.css";

export type ActivityIconType = "in" | "out" | "rewards";

export const ActivityIcon = ({ type }: { type: ActivityIconType }) => (
  <Box className={iconCircle}>
    {type === "rewards" ? (
      <GifIcon />
    ) : type === "out" ? (
      <ArrowDownIcon />
    ) : (
      <ArrowUpIcon />
    )}
  </Box>
);
