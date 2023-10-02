import { Maybe } from "purify-ts";
import { Virtuoso } from "react-virtuoso";
import {
  Box,
  CaretDownIcon,
  SelectModal,
  SelectModalItem,
  SelectModalItemContainer,
  SelectModalProps,
  Text,
} from "../../../../../components";
import { useTranslation } from "react-i18next";
import { Trigger } from "@radix-ui/react-alert-dialog";
import { TokenIcon } from "../../../../../components/atoms/token-icon";
import { formatTokenBalance } from "../../../../../utils";
import { TokenBalanceScanResponseDto } from "@stakekit/api-hooks";
import { State } from "../../../../../state/stake/types";
import { useMemo } from "react";
import BigNumber from "bignumber.js";
import clsx from "clsx";
import { pressAnimation } from "../../../../../components/atoms/button/styles.css";
import {
  hideScrollbar,
  selectItemText,
  validatorVirtuosoContainer,
} from "../../styles.css";

export const SelectToken = ({
  selectedTokenBalance,
  tokenBalances,
  onSearch,
  onItemSelect,
  onSelectOpportunityClose,
  showTokenAmount = true,
}: {
  showTokenAmount?: boolean;
  selectedTokenBalance: State["selectedTokenBalance"];
  tokenBalances: Maybe<TokenBalanceScanResponseDto[]>;
  onSearch: SelectModalProps["onSearch"];
  onItemSelect: (tokenBalance: TokenBalanceScanResponseDto) => void;
  onSelectOpportunityClose: () => void;
}) => {
  const { t } = useTranslation();

  const data = useMemo(
    () =>
      selectedTokenBalance
        .map((stb) => ({
          stb,
          tokenBalances: tokenBalances.extract() ?? [],
        }))
        .extractNullable(),
    [selectedTokenBalance, tokenBalances]
  );

  if (!data) return null;

  return (
    <SelectModal
      title={t("select_token.title")}
      onSearch={onSearch}
      onClose={onSelectOpportunityClose}
      trigger={
        <Trigger asChild>
          <Box
            as="button"
            display="flex"
            justifyContent="center"
            alignItems="center"
            background="background"
            borderRadius="2xl"
            px="2"
            py="1"
            data-testid="select-opportunity"
            className={pressAnimation}
          >
            <Box
              marginRight="2"
              display="flex"
              justifyContent="center"
              alignItems="center"
            >
              <TokenIcon token={data.stb.token} />
              <Text variant={{ weight: "bold" }}>{data.stb.token.symbol}</Text>
            </Box>
            <CaretDownIcon />
          </Box>
        </Trigger>
      }
    >
      <Virtuoso
        className={clsx([hideScrollbar, validatorVirtuosoContainer])}
        data={data.tokenBalances}
        itemContent={(_index, item) => {
          const amount = new BigNumber(item.amount);

          return (
            <SelectModalItemContainer>
              <SelectModalItem onItemClick={() => onItemSelect(item)}>
                <TokenIcon token={item.token} />

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
                  >
                    <Text
                      className={selectItemText}
                      variant={{
                        size: "small",
                        weight: "bold",
                      }}
                    >
                      {item.token.name}
                    </Text>

                    {showTokenAmount && (
                      <Text
                        variant={{
                          size: "small",
                          weight: "normal",
                        }}
                      >
                        {formatTokenBalance(amount, 6)}
                      </Text>
                    )}
                  </Box>

                  <Box
                    display="flex"
                    marginTop="1"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Text
                      variant={{
                        size: "small",
                        type: "muted",
                      }}
                    >
                      {item.token.symbol}
                    </Text>
                  </Box>
                </Box>
              </SelectModalItem>
            </SelectModalItemContainer>
          );
        }}
      />
    </SelectModal>
  );
};
