import { Match } from "effect";
import { Box } from "../../../../../../shared/ui/primitives/box";
import { Arrow } from "../../../../../../shared/ui/primitives/icons/arrow";
import { GifIcon } from "../../../../../../shared/ui/primitives/icons/gift";
import { iconCircle } from "../activity-item.css";

export type ActivityIconType = "in" | "neutral" | "out" | "rewards";

export const ActivityIcon = ({ type }: { type: ActivityIconType }) => {
  const icon = Match.value(type).pipe(
    Match.when("rewards", () => <GifIcon />),
    Match.when("out", () => <Arrow direction="down" />),
    Match.when("in", () => <Arrow direction="up" />),
    Match.when("neutral", () => (
      <svg
        aria-hidden="true"
        data-rk="activity-icon-neutral"
        height="16"
        viewBox="0 0 16 16"
        width="16"
      >
        <path
          d="M3 8h10"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
      </svg>
    )),
    Match.exhaustive
  );

  return <Box className={iconCircle}>{icon}</Box>;
};
