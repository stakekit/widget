import { Match } from "effect";
import { Box } from "../../../../../../shared/ui/primitives/box";
import { Arrow } from "../../../../../../shared/ui/primitives/icons/arrow";
import { GifIcon } from "../../../../../../shared/ui/primitives/icons/gift";
import { iconCircle } from "../activity-item.css";

export type ActivityIconType = "in" | "out" | "rewards";

export const ActivityIcon = ({ type }: { type: ActivityIconType }) => {
  const icon = Match.value(type).pipe(
    Match.when("rewards", () => <GifIcon />),
    Match.when("out", () => <Arrow direction="down" />),
    Match.when("in", () => <Arrow direction="up" />),
    Match.exhaustive
  );

  return <Box className={iconCircle}>{icon}</Box>;
};
