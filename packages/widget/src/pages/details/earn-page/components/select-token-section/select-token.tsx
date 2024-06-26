import { Trigger } from "@radix-ui/react-dialog";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  CaretDownIcon,
  SelectModal,
  Text,
} from "../../../../../components";
import { pressAnimation } from "../../../../../components/atoms/button/styles.css";
import { TokenIcon } from "../../../../../components/atoms/token-icon";
import { VirtualList } from "../../../../../components/atoms/virtual-list";
import { useTrackEvent } from "../../../../../hooks/tracking/use-track-event";
import { useSKWallet } from "../../../../../providers/sk-wallet";
import { useEarnPageContext } from "../../state/earn-page-context";
import { validatorVirtuosoContainer } from "../../styles.css";
import { SelectTokenListItem } from "./select-token-list-item";

export const SelectToken = () => {
  const {
    onSelectTokenClose,
    onTokenBalanceSelect,
    tokenBalancesData,
    selectedToken,
    onTokenSearch,
    tokenSearch,
  } = useEarnPageContext();

  const trackEvent = useTrackEvent();

  const { t } = useTranslation();

  const { isConnected } = useSKWallet();

  const data = useMemo(
    () =>
      selectedToken
        .map((st) => ({
          st,
          tokenBalances:
            tokenBalancesData.map((v) => v.filtered).extract() ?? [],
        }))
        .extractNullable(),
    [selectedToken, tokenBalancesData]
  );

  if (!data) return null;

  return (
    <SelectModal
      title={t("select_token.title")}
      onSearch={onTokenSearch}
      searchValue={tokenSearch}
      onClose={onSelectTokenClose}
      onOpen={() => trackEvent("selectTokenModalOpened")}
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
            data-testid="select-token"
            className={pressAnimation}
          >
            <Box
              marginRight="2"
              display="flex"
              justifyContent="center"
              alignItems="center"
            >
              <TokenIcon token={data.st} />
              <Text variant={{ weight: "bold" }}>{data.st.symbol}</Text>
            </Box>
            <CaretDownIcon />
          </Box>
        </Trigger>
      }
    >
      <VirtualList
        className={validatorVirtuosoContainer}
        data={data.tokenBalances}
        estimateSize={() => 60}
        itemContent={(_index, item) => (
          <SelectTokenListItem
            item={item}
            onTokenBalanceSelect={onTokenBalanceSelect}
            isConnected={isConnected}
          />
        )}
      />
    </SelectModal>
  );
};
