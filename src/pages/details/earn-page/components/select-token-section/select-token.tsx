import {
  Box,
  CaretDownIcon,
  SelectModal,
  SelectModalItem,
  SelectModalItemContainer,
  Text,
} from "../../../../../components";
import { useTranslation } from "react-i18next";
import { Trigger } from "@radix-ui/react-alert-dialog";
import { TokenIcon } from "../../../../../components/atoms/token-icon";
import { useMemo } from "react";
import BigNumber from "bignumber.js";
import { pressAnimation } from "../../../../../components/atoms/button/styles.css";
import { selectItemText, validatorVirtuosoContainer } from "../../styles.css";
import { VirtualList } from "../../../../../components/atoms/virtual-list";
import { useDetailsContext } from "../../hooks/details-context";
import { formatNumber } from "../../../../../utils";

export const SelectToken = () => {
  const {
    onSelectOpportunityClose,
    onTokenBalanceSelect,
    tokenBalancesData,
    selectedTokenBalance,
    onTokenSearch,
    showTokenAmount = true,
  } = useDetailsContext();
  const { t } = useTranslation();

  const data = useMemo(
    () =>
      selectedTokenBalance
        .map((stb) => ({
          stb,
          tokenBalances:
            tokenBalancesData.map((v) => v.filtered).extract() ?? [],
        }))
        .extractNullable(),
    [selectedTokenBalance, tokenBalancesData]
  );

  if (!data) return null;

  return (
    <SelectModal
      title={t("select_token.title")}
      onSearch={onTokenSearch}
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
      <VirtualList
        className={validatorVirtuosoContainer}
        data={data.tokenBalances}
        itemContent={(_index, item) => {
          const amount = new BigNumber(item.amount);

          return (
            <SelectModalItemContainer>
              <SelectModalItem onItemClick={() => onTokenBalanceSelect(item)}>
                <TokenIcon token={item.token} />

                <Box
                  display="flex"
                  flexDirection="column"
                  flex={1}
                  minWidth="0"
                >
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Text
                      className={selectItemText}
                      variant={{ weight: "bold" }}
                    >
                      {item.token.name}
                    </Text>

                    {showTokenAmount && (
                      <Text variant={{ weight: "normal" }}>
                        {formatNumber(amount)}
                      </Text>
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
        }}
      />
    </SelectModal>
  );
};
