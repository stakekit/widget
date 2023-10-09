import { Box } from "../../atoms/box";
import { Text } from "../../atoms/typography";
import { Trans } from "react-i18next";
import { inlineText } from "./style.css";
import { Image } from "../../atoms/image";
import { useRewardTokenDetails } from "../../../hooks/use-reward-token-details";
import { ActionTypes } from "@stakekit/api-hooks";
import { ImageFallback } from "../../atoms/image-fallback";

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
    .map((rt) => (
      <>
        <Box display="flex" alignItems="center">
          {rt.logoUri && (
            <Box marginRight="1">
              <Image
                borderRadius="full"
                hw="5"
                src={rt.logoUri}
                fallback={
                  <ImageFallback name={rt.providerName} tokenLogoHw="5" />
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
                  ? `pending_action_review.pending_action_type.${
                      rest.pendingAction.toLowerCase() as Lowercase<ActionTypes>
                    }`
                  : "unstake_review.unstake_from"
              }
              values={{
                symbol: rt.symbol,
                providerName: rt.providerName,
              }}
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
    ))
    .extractNullable();
};
