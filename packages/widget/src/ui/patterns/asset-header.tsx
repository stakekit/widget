import { TokenAvatar } from "../components/avatar";
import { Badge } from "../components/badge";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import type { Tone } from "../tone";
import type { TokenLogo } from "./token";

type AssetHeaderProps = {
  /** The yield's or position's name. */
  readonly title: string;
  /** The heading level the page's outline needs. */
  readonly as?: "h1" | "h2" | "h3";
  /** The token the yield or position holds, with its network badge. */
  readonly token: TokenLogo;
  /** Who provides it, beside the provider's logo. */
  readonly provider?: {
    /** The provider's name, for its logo's fallback initial. */
    readonly name: string;
    /** The line naming it, such as "via Lido". */
    readonly label: string;
    /** The provider's logo URL. */
    readonly src?: string;
  };
  /** Facts after the provider, such as the network and the token symbol. */
  readonly details?: ReadonlyArray<string>;
  /** Short statuses after the facts, such as "Auto-compounding". */
  readonly badges?: ReadonlyArray<{
    readonly label: string;
    readonly tone?: Tone;
  }>;
  /**
   * `default` heads a details pane with a 48px logo and a title; `compact`
   * heads a position's page with a 40px logo and a heading, so the actions
   * under it stay in view.
   */
  readonly density?: "default" | "compact";
};

/**
 * The head of a yield's or position's page: the token's logo with its network
 * badge, the name, and a line with the provider, facts and badges.
 */
export const AssetHeader = ({
  title,
  as = "h2",
  token,
  provider,
  details = [],
  badges = [],
  density = "default",
}: AssetHeaderProps) => (
  <Stack direction="row" align="center" gap={12}>
    <TokenAvatar
      {...token}
      size={density === "compact" ? "card" : "lg"}
      decorative
    />
    <Stack gap={density === "compact" ? 2 : 4} grow>
      <Text
        variant={density === "compact" ? "heading" : "title"}
        as={as}
        truncate
      >
        {title}
      </Text>
      {(provider !== undefined || details.length > 0 || badges.length > 0) && (
        <Stack direction="row" align="center" gap={6} wrap>
          {provider !== undefined && (
            <Stack direction="row" align="center" gap={4}>
              <TokenAvatar
                size="xs"
                name={provider.name}
                decorative
                {...(provider.src === undefined ? {} : { src: provider.src })}
              />
              <Text variant="caption" weight="medium">
                {provider.label}
              </Text>
            </Stack>
          )}
          {details.length > 0 && (
            <Text variant="caption" tone="muted">
              {(provider === undefined ? details : ["", ...details]).join(
                " · "
              )}
            </Text>
          )}
          {badges.map((badge) => (
            <Badge key={badge.label} tone={badge.tone ?? "neutral"}>
              {badge.label}
            </Badge>
          ))}
        </Stack>
      )}
    </Stack>
  </Stack>
);
