import BigNumber from "bignumber.js";
import type { ComponentProps } from "react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Box } from "../../../../../components/atoms/box";
import {
  SelectModalItem,
  SelectModalItemContainer,
} from "../../../../../components/atoms/select-modal";
import { TokenIcon } from "../../../../../components/atoms/token-icon";
import { Text } from "../../../../../components/atoms/typography/text";
import type { TokenBalanceScanResponseDto } from "../../../../../domain/types/token-balance";
import type { TokenMaxYieldRate } from "../../../../../hooks/api/use-token-list-yields";
import { useTrackEvent } from "../../../../../hooks/tracking/use-track-event";
import { selectItemText } from "../../styles.css";
import { maxYieldRateLabel, maxYieldRateText } from "./styles.css";

type Props = {
  item: TokenBalanceScanResponseDto;
  isConnected: boolean;
  isSelected: boolean;
  availableYieldsCount?: number;
  canSelectToken?: boolean;
  maxYieldRate?: TokenMaxYieldRate;
  onTokenBalanceSelect: (tokenBalance: TokenBalanceScanResponseDto) => void;
};

export const SelectTokenListItem = memo(
  ({
    item,
    isConnected,
    isSelected,
    availableYieldsCount = item.availableYields.length,
    canSelectToken = true,
    maxYieldRate,
    onTokenBalanceSelect,
  }: Props) => {
    const amountGreaterThanZero = new BigNumber(item.amount).isGreaterThan(0);

    const trackEvent = useTrackEvent();
    const { t } = useTranslation();

    const _onItemClick: ComponentProps<typeof SelectModalItem>["onItemClick"] =
      ({ closeModal }) => {
        if (!canSelectToken) return;

        trackEvent("tokenSelected", { token: item.token.symbol });
        onTokenBalanceSelect(item);
        closeModal();
      };

    return (
      <SelectModalItemContainer>
        <SelectModalItem
          selected={isSelected}
          variant={
            !canSelectToken
              ? { type: "disabled", hover: "disabled" }
              : amountGreaterThanZero || !isConnected
                ? { type: "enabled", hover: "enabled" }
                : { type: "disabled", hover: "enabled" }
          }
          onItemClick={_onItemClick}
        >
          <TokenIcon token={item.token} />

          <Box
            display="flex"
            flex={1}
            justifyContent="space-between"
            alignItems="center"
            marginLeft="2"
            minWidth="0"
            gap="2"
          >
            <Box display="flex" flexDirection="column" minWidth="0" gap="1">
              <Text className={selectItemText} variant={{ weight: "bold" }}>
                {item.token.symbol}
              </Text>

              <Text
                variant={{ type: "muted", weight: "normal", size: "small" }}
              >
                {t("select_token.yields_available", {
                  count: availableYieldsCount,
                  token_name: item.token.name,
                })}
              </Text>
            </Box>

            {maxYieldRate ? (
              <Box
                textAlign="end"
                flexShrink={0}
                gap="1"
                display="flex"
                flexDirection="column"
              >
                <Text className={maxYieldRateText}>
                  {maxYieldRate.rateFormatted}
                </Text>

                <Text
                  className={maxYieldRateLabel}
                  variant={{ type: "muted", weight: "normal", size: "small" }}
                >
                  {t("select_token.up_to_rate_type", {
                    rateType: maxYieldRate.rateTypeLabel,
                  })}
                </Text>
              </Box>
            ) : null}
          </Box>
        </SelectModalItem>
      </SelectModalItemContainer>
    );
  }
);
