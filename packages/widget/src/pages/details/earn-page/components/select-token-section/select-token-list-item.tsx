import BigNumber from "bignumber.js";
import clsx from "clsx";
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
import { useSettings } from "../../../../../providers/settings";
import { combineRecipeWithVariant } from "../../../../../utils/styles";
import { selectItemText } from "../../styles.css";
import {
  maxYieldRateLabel,
  maxYieldRateText,
  selectedListItem,
} from "./styles.css";

type Props = {
  item: TokenBalanceScanResponseDto;
  isConnected: boolean;
  isSelected: boolean;
  maxYieldRate?: TokenMaxYieldRate;
  onTokenBalanceSelect: (tokenBalance: TokenBalanceScanResponseDto) => void;
};

export const SelectTokenListItem = memo(
  ({
    item,
    isConnected,
    isSelected,
    maxYieldRate,
    onTokenBalanceSelect,
  }: Props) => {
    const amountGreaterThanZero = new BigNumber(item.amount).isGreaterThan(0);

    const trackEvent = useTrackEvent();
    const { t } = useTranslation();
    const { variant } = useSettings();

    const _onItemClick: ComponentProps<typeof SelectModalItem>["onItemClick"] =
      ({ closeModal }) => {
        trackEvent("tokenSelected", { token: item.token.symbol });
        onTokenBalanceSelect(item);
        closeModal();
      };

    return (
      <SelectModalItemContainer>
        <SelectModalItem
          className={clsx(
            isSelected &&
              combineRecipeWithVariant({
                rec: selectedListItem,
                variant,
              })
          )}
          variant={
            amountGreaterThanZero || !isConnected
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
            <Box display="flex" flexDirection="column" minWidth="0">
              <Text className={selectItemText} variant={{ weight: "bold" }}>
                {item.token.symbol}
              </Text>

              <Text marginTop="1" variant={{ type: "muted", weight: "normal" }}>
                {t("select_token.yields_available", {
                  count: item.availableYields.length,
                  token_name: item.token.name,
                })}
              </Text>
            </Box>

            {maxYieldRate ? (
              <Box textAlign="end" flexShrink={0}>
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
