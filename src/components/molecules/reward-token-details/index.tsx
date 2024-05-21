import type { ActionTypes } from "@stakekit/api-hooks";
import { Trans } from "react-i18next";
import type { useRewardTokenDetails } from "../../../hooks/use-reward-token-details";
import { Box } from "../../atoms/box";
import { Image } from "../../atoms/image";
import { ImageFallback } from "../../atoms/image-fallback";
import { Text } from "../../atoms/typography";
import { inlineText } from "./style.css";

export const RewardTokenDetails = ({
  rewardToken,
  ...rest
}: {
  rewardToken: ReturnType<typeof useRewardTokenDetails>;
} & (
  | { type: "stake" | "unstake"; pendingAction?: never }
  | {
      type: "pendingAction";
      pendingAction: ActionTypes;
    }
)) => {
  return rewardToken
    .map((rt) => {
      return (
        <>
          <Box display="flex" alignItems="center">
            {rt.logoUri && (
              <Box marginRight="1">
                <Image
                  imageProps={{ borderRadius: "full" }}
                  containerProps={{ hw: "5" }}
                  src={rt.logoUri}
                  fallback={
                    <ImageFallback
                      name={rt.providerName ?? rt.symbol}
                      tokenLogoHw="5"
                    />
                  }
                />
              </Box>
            )}

            <Text variant={{ weight: "semibold" }}>
              <Trans
                i18nKey={
                  rest.type === "stake"
                    ? "details.reward_token"
                    : rest.type === "pendingAction"
                      ? (`pending_action_review.pending_action_type.${
                          rest.pendingAction.toLowerCase() as Lowercase<ActionTypes>
                        }` as const)
                      : "unstake_review.unstake_from"
                }
                values={{ symbol: rt.symbol, providerName: rt.providerName }}
                components={{
                  highlight0: (
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
        </>
      );
    })
    .extractNullable();
};
