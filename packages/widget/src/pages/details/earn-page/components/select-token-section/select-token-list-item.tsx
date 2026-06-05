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
import { useTrackEvent } from "../../../../../hooks/tracking/use-track-event";
import { useSettings } from "../../../../../providers/settings";
import { combineRecipeWithVariant } from "../../../../../utils/styles";
import { selectItemText } from "../../styles.css";
import { selectedListItem } from "./styles.css";

type Props = {
  item: TokenBalanceScanResponseDto;
  isConnected: boolean;
  isSelected: boolean;
  onTokenBalanceSelect: (tokenBalance: TokenBalanceScanResponseDto) => void;
};

export const SelectTokenListItem = memo(
  ({ item, isConnected, isSelected, onTokenBalanceSelect }: Props) => {
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
            flexDirection="column"
            flex={1}
            marginLeft="2"
            minWidth="0"
          >
            <Text className={selectItemText} variant={{ weight: "bold" }}>
              {item.token.symbol}
            </Text>

            <Text marginTop="1" variant={{ type: "muted" }}>
              {t("select_token.yields_available", {
                count: item.availableYields.length,
              })}
            </Text>
          </Box>
        </SelectModalItem>
      </SelectModalItemContainer>
    );
  }
);
