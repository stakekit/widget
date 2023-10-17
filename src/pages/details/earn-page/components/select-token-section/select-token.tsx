import {
  Box,
  CaretDownIcon,
  SelectModal,
  Text,
} from "../../../../../components";
import { useTranslation } from "react-i18next";
import { Trigger } from "@radix-ui/react-alert-dialog";
import { TokenIcon } from "../../../../../components/atoms/token-icon";
import { useMemo } from "react";
import { pressAnimation } from "../../../../../components/atoms/button/styles.css";
import { validatorVirtuosoContainer } from "../../styles.css";
import { VirtualList } from "../../../../../components/atoms/virtual-list";
import { useDetailsContext } from "../../state/details-context";
import { SelectTokenListItem } from "./select-token-list-item";
import { useSKWallet } from "../../../../../hooks/wallet/use-sk-wallet";

export const SelectToken = () => {
  const {
    onSelectOpportunityClose,
    onTokenBalanceSelect,
    tokenBalancesData,
    selectedTokenBalance,
    onTokenSearch,
    tokenSearch,
  } = useDetailsContext();

  const { t } = useTranslation();

  const { isNotConnectedOrReconnecting } = useSKWallet();

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
      searchValue={tokenSearch}
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
        itemContent={(_index, item) => (
          <SelectTokenListItem
            item={item}
            onTokenBalanceSelect={onTokenBalanceSelect}
            isNotConnectedOrReconnecting={isNotConnectedOrReconnecting}
          />
        )}
      />
    </SelectModal>
  );
};
