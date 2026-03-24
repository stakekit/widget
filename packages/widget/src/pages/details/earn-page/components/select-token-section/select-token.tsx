import { Trigger } from "@radix-ui/react-dialog";
import clsx from "clsx";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box } from "../../../../../components/atoms/box";
import {
  pressAnimation,
  selectTokenButton,
} from "../../../../../components/atoms/button/styles.css";
import { CaretDownIcon } from "../../../../../components/atoms/icons/caret-down";
import { SelectModal } from "../../../../../components/atoms/select-modal";
import { TokenIcon } from "../../../../../components/atoms/token-icon";
import { Text } from "../../../../../components/atoms/typography/text";
import { VirtualList } from "../../../../../components/atoms/virtual-list";
import { useTrackEvent } from "../../../../../hooks/tracking/use-track-event";
import { useSettings } from "../../../../../providers/settings";
import { useSKWallet } from "../../../../../providers/sk-wallet";
import { combineRecipeWithVariant } from "../../../../../utils/styles";
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

  const { variant } = useSettings();

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
            borderRadius="2xl"
            px="2"
            py="1"
            data-testid="select-token"
            className={clsx(
              pressAnimation,
              combineRecipeWithVariant({
                variant,
                rec: selectTokenButton,
              })
            )}
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
