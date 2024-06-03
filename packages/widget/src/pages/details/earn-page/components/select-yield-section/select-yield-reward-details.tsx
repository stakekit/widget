import { Trans, useTranslation } from "react-i18next";
import { Box, Text } from "../../../../../components";
import { Image } from "../../../../../components/atoms/image";
import { ImageFallback } from "../../../../../components/atoms/image-fallback";
import { TokenIcon } from "../../../../../components/atoms/token-icon";
import { RewardTokenDetails } from "../../../../../components/molecules/reward-token-details";
import { useSettings } from "../../../../../providers/settings";
import { useEarnPageContext } from "../../state/earn-page-context";

export const SelectYieldRewardDetails = () => {
  const { t } = useTranslation();

  const { variant } = useSettings();

  const { rewardToken, estimatedRewards, symbol, pointsRewardTokens } =
    useEarnPageContext();

  const earnYearly = estimatedRewards.mapOrDefault(
    (e) => `${e.yearly} ${symbol}`,
    ""
  );
  const earnMonthly = estimatedRewards.mapOrDefault(
    (e) => `${e.monthly} ${symbol}`,
    ""
  );

  return (
    <Box data-rk="yield-rewards">
      {variant === "default" && (
        <Box marginTop="3">
          <RewardTokenDetails rewardToken={rewardToken} type="stake" />
        </Box>
      )}

      <Box display="flex" flexDirection="column" gap="2" marginTop="3">
        {variant === "zerion" &&
          rewardToken
            .map((rt) => (
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                gap="2"
              >
                <Text variant={{ type: "muted", weight: "normal" }}>
                  <Trans
                    i18nKey="details.rewards.receive"
                    values={{ symbol: rt.symbol }}
                    components={{ span0: <Box as="span" fontWeight="bold" /> }}
                  />
                </Text>

                <Box display="flex" justifyContent="center" alignItems="center">
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
                  <Text variant={{ type: "muted", weight: "normal" }}>
                    {rt.providerName}
                  </Text>
                </Box>
              </Box>
            ))
            .extractNullable()}

        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          data-testid="estimated-reward__yearly"
          data-rk="estimated-reward__yearly"
          gap="2"
        >
          <Text variant={{ type: "muted", weight: "normal" }}>
            {t(
              variant === "zerion" ? "details.rewards.yearly" : "shared.yearly"
            )}
          </Text>
          <Text variant={{ type: "muted", weight: "normal" }}>
            {earnYearly}
          </Text>
        </Box>

        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          data-testid="estimated-reward__monthly"
          data-rk="estimated-reward__monthly"
          gap="2"
        >
          <Text variant={{ type: "muted", weight: "normal" }}>
            {t("shared.monthly")}
          </Text>
          <Text variant={{ type: "muted", weight: "normal" }}>
            {earnMonthly}
          </Text>
        </Box>

        {pointsRewardTokens
          .filter((val) => !!val.length)
          .map((val) => (
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              data-testid="estimated-reward__points"
              gap="2"
            >
              <Text variant={{ type: "muted", weight: "normal" }}>
                {t("shared.points")}
              </Text>

              <Box display="flex" gap="1">
                {val.map((v, i) => (
                  <Box
                    key={i}
                    background="background"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    borderRadius="lg"
                    px="2"
                    py="1"
                    gap="2"
                  >
                    <TokenIcon token={v} hideNetwork tokenLogoHw="5" />

                    <Text variant={{ type: "muted", weight: "normal" }}>
                      {v.name.replace(/points/i, "")}
                    </Text>
                  </Box>
                ))}
              </Box>
            </Box>
          ))
          .extractNullable()}
      </Box>
    </Box>
  );
};
