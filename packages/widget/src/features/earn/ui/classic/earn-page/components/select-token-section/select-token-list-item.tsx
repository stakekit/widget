import BigNumber from "bignumber.js";
import type { ComponentProps } from "react";
import { memo } from "react";
import { Box } from "../../../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../../../shared/ui/primitives/typography/text";
import { useTrackEvent } from "../../../../../../tracking/react/use-track-event";
import {
  SelectModalItem,
  SelectModalItemContainer,
} from "../../../../../../widget-shell/ui/select-modal";
import { TokenIcon } from "../../../../../../widget-shell/ui/token-icon";
import type { EarnTokenOption } from "../../../../../state/atoms-state/types";
import { selectItemText } from "../../styles.css";

type Props = {
  item: EarnTokenOption;
  isConnected: boolean;
  isSelected: boolean;
  onTokenBalanceSelect: (tokenBalance: EarnTokenOption) => void;
};

export const SelectTokenListItem = memo(
  ({ item, isConnected, isSelected, onTokenBalanceSelect }: Props) => {
    const amountGreaterThanZero = new BigNumber(item.amount).isGreaterThan(0);

    const trackEvent = useTrackEvent();

    const _onItemClick: ComponentProps<typeof SelectModalItem>["onItemClick"] =
      ({ closeModal }) => {
        trackEvent("tokenSelected", { token: item.token.symbol });
        onTokenBalanceSelect(item);
        closeModal();
      };

    return (
      <SelectModalItemContainer>
        <SelectModalItem
          selected={isSelected}
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
            <Box display="flex" flexDirection="column" minWidth="0" gap="1">
              <Text className={selectItemText} variant={{ weight: "bold" }}>
                {item.token.symbol}
              </Text>

              <Text
                variant={{ type: "muted", weight: "normal", size: "small" }}
              >
                {item.token.name}
              </Text>
            </Box>
          </Box>
        </SelectModalItem>
      </SelectModalItemContainer>
    );
  }
);
