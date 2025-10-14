import type { YieldDto } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { APToPercentage, formatNumber, fromWei } from "../../../utils";
import { getRewardRateFormatted } from "../../../utils/formatters";
import { Box } from "../../atoms/box";
import { SelectModalItem } from "../../atoms/select-modal";
import { ProviderIcon } from "../../atoms/token-icon/provider-icon";
import { Text } from "../../atoms/typography/text";
import { selectItemText } from "./styles.css";

export const SelectOpportunityListItem = ({
  item,
  onYieldSelect,
  testId,
}: {
  item: YieldDto;
  onYieldSelect: (item: YieldDto) => void;
  testId?: string;
}) => {
  const onItemClick: ComponentProps<typeof SelectModalItem>["onItemClick"] = ({
    closeModal,
  }) => {
    onYieldSelect(item);
    closeModal();
  };

  const { t } = useTranslation();

  return (
    <SelectModalItem testId={testId} onItemClick={onItemClick}>
      <ProviderIcon metadata={item.metadata} token={item.token} />

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
              {item.metadata.name}
            </Text>
          </Box>

          <Box>
            <Text>
              {getRewardRateFormatted({
                rewardRate: item.rewardRate,
                rewardType: item.rewardType,
              })}
            </Text>
          </Box>
        </Box>

        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" marginTop="1" flexWrap="wrap" gap="1">
            <Text variant={{ type: "muted" }}>
              {Maybe.fromNullable(item.metadata.rewardTokens)
                .map((rt) => rt.map((t) => t.symbol).join(", "))
                .altLazy(() =>
                  Maybe.fromNullable(item.metadata.tvl)
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

            {Maybe.fromNullable(item.metadata.rewardTokens)
              .map((): ReactNode | string => (
                <Box background="background" borderRadius="2xl" px="2">
                  <Text variant={{ type: "muted" }}>{item.token.symbol}</Text>
                </Box>
              ))
              .extractNullable()}
          </Box>

          {Maybe.fromNullable(item.metadata.commission)
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
