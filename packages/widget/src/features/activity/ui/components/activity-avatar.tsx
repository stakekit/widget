import type { Token } from "../../../../domain/token/token";
import { useTokenLogo } from "../../../../shared/react/token-logo";
import {
  type FixedIconName,
  Icon,
  IconAvatar,
  TokenAvatar,
} from "../../../../ui/index";
import type { ActivityDirection } from "../../model/activity-action-list-item";

const DIRECTION_ICON: Record<ActivityDirection, FixedIconName> = {
  deposit: "ArrowUpIcon",
  neutral: "MinusIcon",
  rewards: "GiftIcon",
  withdraw: "ArrowDownIcon",
};

type AvatarSize = "md" | "lg";

const ActionTokenAvatar = ({
  icon,
  size,
  token,
}: {
  readonly icon: FixedIconName;
  readonly size: AvatarSize;
  readonly token: Token;
}) => (
  <TokenAvatar
    {...useTokenLogo(token, { badge: "none" })}
    badgeIcon={icon}
    size={size}
  />
);

/**
 * An action's token with what the action did as its badge, where a token's
 * avatar shows its network; with no known token, what it did alone.
 */
export const ActivityAvatar = ({
  direction,
  size = "md",
  token,
}: {
  readonly direction: ActivityDirection;
  readonly size?: AvatarSize;
  readonly token: Token | null;
}) =>
  token ? (
    <ActionTokenAvatar
      icon={DIRECTION_ICON[direction]}
      size={size}
      token={token}
    />
  ) : (
    <IconAvatar size={size}>
      <Icon name={DIRECTION_ICON[direction]} />
    </IconAvatar>
  );
