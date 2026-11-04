import { Match } from "effect";
import { Icon, IconAvatar } from "../../../../../../ui/index";

export type ActivityIconType = "in" | "neutral" | "out" | "rewards";

export const ActivityIcon = ({ type }: { readonly type: ActivityIconType }) => (
  <IconAvatar>
    {Match.value(type).pipe(
      Match.when("rewards", () => <Icon name="GiftIcon" />),
      Match.when("out", () => <Icon name="ArrowIcon" direction="down" />),
      Match.when("in", () => <Icon name="ArrowIcon" direction="up" />),
      Match.when("neutral", () => <Icon name="MinusIcon" />),
      Match.exhaustive
    )}
  </IconAvatar>
);
