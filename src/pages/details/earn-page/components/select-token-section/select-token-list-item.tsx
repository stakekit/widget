import { memo, useMemo } from "react";
import {
  Box,
  SelectModalItem,
  SelectModalItemContainer,
  Text,
} from "../../../../../components";
import { TokenIcon } from "../../../../../components/atoms/token-icon";
import { formatNumber } from "../../../../../utils";
import { TokenBalanceScanResponseDto } from "@stakekit/api-hooks";
import { selectItemText } from "../../styles.css";
import BigNumber from "bignumber.js";

export const SelectTokenListItem = memo(
  ({
    item,
    isNotConnectedOrReconnecting,
    onTokenBalanceSelect,
  }: {
    item: TokenBalanceScanResponseDto;
    isNotConnectedOrReconnecting: boolean;
    onTokenBalanceSelect: (tokenBalance: TokenBalanceScanResponseDto) => void;
  }) => {
    const amount = useMemo(() => new BigNumber(item.amount), [item.amount]);

    const formattedAmount = useMemo(() => formatNumber(amount), [amount]);

    const amountGreaterThanZero = useMemo(
      () => amount.isGreaterThan(0),
      [amount]
    );

    return (
      <SelectModalItemContainer>
        <SelectModalItem
          variant={
            amountGreaterThanZero || isNotConnectedOrReconnecting
              ? { type: "enabled", hover: "enabled" }
              : { type: "disabled", hover: "enabled" }
          }
          onItemClick={() => onTokenBalanceSelect(item)}
        >
          <TokenIcon token={item.token} />

          <Box display="flex" flexDirection="column" flex={1} minWidth="0">
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Text className={selectItemText} variant={{ weight: "bold" }}>
                {item.token.name}
              </Text>

              {amountGreaterThanZero && (
                <Text variant={{ weight: "normal" }}>{formattedAmount}</Text>
              )}
            </Box>

            <Box
              display="flex"
              marginTop="1"
              justifyContent="space-between"
              alignItems="center"
            >
              <Text variant={{ type: "muted" }}>{item.token.symbol}</Text>
            </Box>
          </Box>
        </SelectModalItem>
      </SelectModalItemContainer>
    );
  }
);
