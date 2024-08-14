import { MorphoStarsIcon } from "@sk-widget/components/atoms/icons/morpho-stars";
import type { ActionTypes } from "@stakekit/api-hooks";
import type { ComponentProps } from "react";
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
  const i18nKey: ComponentProps<typeof Trans>["i18nKey"] = (() => {
    if (rest.type === "stake") {
      return "details.reward_token";
    }

    if (rest.type === "pendingAction") {
      return `pending_action_review.pending_action_type.${
        rest.pendingAction.toLowerCase() as Lowercase<ActionTypes>
      }` as const;
    }

    return "unstake_review.unstake_from";
  })();

  return rewardToken
    .map((rt) => {
      return (
        <>
          <Box display="flex" alignItems="center" gap="2">
            {rt.logoUri && (
              <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                gap="1"
                alignSelf="flex-start"
              >
                <Image
                  imageProps={{ borderRadius: "full" }}
                  containerProps={{ hw: "5" }}
                  src={rt.logoUri}
                  fallback={
                    <ImageFallback name={rt.providerName} tokenLogoHw="5" />
                  }
                />

                {isMorphoProvider(rt.providerName) && (
                  <Box width="5" height="5">
                    <MorphoStarsIcon />
                  </Box>
                )}
              </Box>
            )}

            <Text variant={{ weight: "semibold" }}>
              <Trans
                i18nKey={i18nKey}
                values={{ providerName: rt.providerName }}
                components={{
                  symbols1: <>{rt.symbols}</>,
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
        </>
      );
    })
    .extractNullable();
};

export const isMorphoProvider = (providerName: string) =>
  /morpho/i.test(providerName);
