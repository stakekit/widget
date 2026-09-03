import type { ComponentProps } from "react";
import { Trans } from "react-i18next";
import type { YieldPendingActionType } from "../../../../../domain/action/pending-action";
import { humanizePendingActionType } from "../../../../../shared/lib/formatters";
import { Box } from "../../../../../shared/ui/primitives/box";
import { MorphoStarsIcon } from "../../../../../shared/ui/primitives/icons/morpho-stars";
import { Image } from "../../../../../shared/ui/primitives/image";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import type { YieldSummaryRewardToken } from "../../../model/yield-summary";
import { getRewardTokenSymbols } from "./get-reward-token-symbols";
import { inlineText } from "./style.css";

export const RewardTokenDetails = ({
  rewardToken,
  ...rest
}: {
  rewardToken: YieldSummaryRewardToken | null;
} & (
  | { type: "stake" | "unstake"; pendingAction?: never }
  | {
      type: "pendingAction";
      pendingAction: YieldPendingActionType;
    }
)) => {
  const i18nKey: ComponentProps<typeof Trans>["i18nKey"] = (() => {
    if (rest.type === "stake") {
      return "details.reward_token";
    }

    if (rest.type === "pendingAction") {
      return `pending_action_review.pending_action_type.${
        rest.pendingAction.toLowerCase() as Lowercase<YieldPendingActionType>
      }` as const;
    }

    return "unstake_review.unstake_from";
  })();

  const i18nDefaults =
    rest.type === "pendingAction"
      ? humanizePendingActionType(rest.pendingAction)
      : undefined;

  if (!rewardToken) return null;
  const symbols = getRewardTokenSymbols(rewardToken.rewardTokens);

  return (
    <Box display="flex" alignItems="center" gap="2">
      {rewardToken.logoUri && isMorphoProvider(rewardToken.providerName) ? (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          gap="1"
          alignSelf="flex-start"
        >
          <Image
            imgProps={{ borderRadius: "full" }}
            wrapperProps={{ hw: "5" }}
            src={rewardToken.logoUri}
            fallbackName={rewardToken.providerName}
          />

          <Box width="5" height="5">
            <MorphoStarsIcon />
          </Box>
        </Box>
      ) : null}

      <Text variant={{ weight: "semibold" }}>
        <Trans
          i18nKey={i18nKey}
          defaults={i18nDefaults}
          values={{ providerName: rewardToken.providerName }}
          components={{
            symbols1: (
              <Text as="span" variant={{ weight: "semibold" }}>
                {symbols}
              </Text>
            ),
            highlight2: (
              <Text
                as="span"
                className={inlineText}
                variant={{ type: "muted", weight: "medium" }}
              />
            ),
          }}
        />
      </Text>
    </Box>
  );
};

export const isMorphoProvider = (providerName: string) =>
  /morpho/i.test(providerName);
