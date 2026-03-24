import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  getRewardRateBreakdown,
  getYieldRewardRateDetails,
} from "../../../domain/types/reward-rate";
import {
  getYieldMetadata,
  getYieldRewardRate,
  getYieldRewardTokens,
  getYieldRewardType,
  type Yield,
} from "../../../domain/types/yields";
import { APToPercentage, formatNumber, fromWei } from "../../../utils";
import { getRewardRateFormatted } from "../../../utils/formatters";
import { Box } from "../../atoms/box";
import { SelectModalItem } from "../../atoms/select-modal";
import { ProviderIcon } from "../../atoms/token-icon/provider-icon";
import { Text } from "../../atoms/typography/text";
import { noWrap, selectItemText } from "./styles.css";

export const SelectOpportunityListItem = ({
  item,
  onYieldSelect,
  testId,
}: {
  item: Yield;
  onYieldSelect: (item: Yield) => void;
  testId?: string;
}) => {
  const onItemClick: ComponentProps<typeof SelectModalItem>["onItemClick"] = ({
    closeModal,
  }) => {
    onYieldSelect(item);
    closeModal();
  };

  const { t } = useTranslation();

  const campaignRate = getRewardRateBreakdown(
    getYieldRewardRateDetails(item)
  ).find((rewardRate) => rewardRate.key === "campaign");

  const totalRateFormatted = getRewardRateFormatted({
    rewardRate: getYieldRewardRate(item),
    rewardType: getYieldRewardType(item),
  });

  const primaryRateFormatted = getRewardRateFormatted({
    rewardRate: campaignRate
      ? getYieldRewardRate(item) - campaignRate.rate
      : getYieldRewardRate(item),
    rewardType: getYieldRewardType(item),
  });

  const metadata = getYieldMetadata(item);
  const rewardTokens = getYieldRewardTokens(item);

  return (
    <SelectModalItem testId={testId} onItemClick={onItemClick}>
      <ProviderIcon
        metadata={metadata as Parameters<typeof ProviderIcon>[0]["metadata"]}
        token={item.token as Parameters<typeof ProviderIcon>[0]["token"]}
      />

      <Box
        display="flex"
        flexDirection="column"
        flex={1}
        marginLeft="2"
        minWidth="0"
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          gap="2"
        >
          <Box>
            <Text className={selectItemText} variant={{ weight: "bold" }}>
              {metadata.name}
            </Text>
          </Box>

          <Box textAlign="end">
            <Text className={noWrap}>{primaryRateFormatted}</Text>

            {campaignRate ? (
              <Text variant={{ type: "muted", weight: "normal" }}>
                {t("details.apy_composition.up_to", {
                  value: totalRateFormatted,
                })}
              </Text>
            ) : null}
          </Box>
        </Box>

        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" marginTop="1" flexWrap="wrap" gap="1">
            <Text variant={{ type: "muted" }}>
              {Maybe.fromNullable(rewardTokens.length ? rewardTokens : null)
                .map((rt) => rt.map((t) => t.symbol).join(", "))
                .altLazy(() =>
                  Maybe.fromNullable(metadata.tvl)
                    .map((tvl) =>
                      tvl.reduce(
                        (acc, curr) => acc.plus(curr.value),
                        BigNumber(0)
                      )
                    )
                    .map(
                      (tvl) =>
                        `TVL: ${formatNumber(fromWei(tvl, item.token.decimals), 0)} ${item.token.symbol}`
                    )
                )
                .orDefault(item.token.symbol)}
            </Text>

            {Maybe.fromNullable(rewardTokens.length ? rewardTokens : null)
              .map((): ReactNode | string => (
                <Box background="background" borderRadius="2xl" px="2">
                  <Text variant={{ type: "muted" }}>{item.token.symbol}</Text>
                </Box>
              ))
              .extractNullable()}
          </Box>

          {Maybe.fromNullable(metadata.commission)
            .map((commission) =>
              APToPercentage(
                commission.reduce((acc, curr) => acc + curr.value, 0)
              )
            )
            .map((commission) => (
              <Text
                variant={{ type: "muted" }}
              >{`${t("shared.fee")}: ${formatNumber(commission, 2)}%`}</Text>
            ))
            .extractNullable()}
        </Box>
      </Box>
    </SelectModalItem>
  );
};
