import { Trigger } from "@radix-ui/react-dialog";
import clsx from "clsx";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../../../app/config/use-widget-config";
import { equalTokens } from "../../../../../../../domain/types/tokens";
import { combineRecipeWithVariant } from "../../../../../../../shared/styles/recipe-variant";
import { VirtualList } from "../../../../../../../shared/ui/components/virtual-list";
import { Box } from "../../../../../../../shared/ui/primitives/box";
import {
  pressAnimation,
  selectTokenButton,
} from "../../../../../../../shared/ui/primitives/button/styles.css";
import { CaretDownIcon } from "../../../../../../../shared/ui/primitives/icons/caret-down";
import { Text } from "../../../../../../../shared/ui/primitives/typography/text";
import { useTrackEvent } from "../../../../../../tracking/react/use-track-event";
import { useSKWallet } from "../../../../../../wallet/react/use-wallet";
import { SelectModal } from "../../../../../../widget-shell/ui/select-modal";
import { TokenIcon } from "../../../../../../widget-shell/ui/token-icon";
import { useEarnPageModel } from "../../state/earn-page-model";
import { validatorVirtuosoContainer } from "../../styles.css";
import { SelectTokenListItem } from "./select-token-list-item";

export const SelectToken = ({ canSelect = true }: { canSelect?: boolean }) => {
  const {
    onSelectTokenClose,
    onTokenBalanceSelect,
    tokenBalancesData,
    selectedToken,
    onTokenSearch,
    tokenSearch,
    hasMoreTokens,
    isLoadingMoreTokens,
    onLoadMoreTokens,
  } = useEarnPageModel();

  const variant = useWidgetConfig("variant");

  const trackEvent = useTrackEvent();

  const { t } = useTranslation();

  const { isConnected } = useSKWallet();

  const data = useMemo(
    () =>
      selectedToken
        ? { st: selectedToken, tokenBalances: tokenBalancesData.filtered }
        : null,
    [selectedToken, tokenBalancesData]
  );

  if (!data) return null;

  if (!canSelect) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        borderRadius="2xl"
        px="2"
        py="1"
        gap="2"
        data-testid="select-token"
        className={combineRecipeWithVariant({
          variant,
          rec: selectTokenButton,
        })}
      >
        <TokenIcon token={data.st} />
        <Text variant={{ weight: "bold" }}>{data.st.symbol}</Text>
      </Box>
    );
  }

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
        hasNextPage={hasMoreTokens}
        isFetchingNextPage={isLoadingMoreTokens}
        fetchNextPage={onLoadMoreTokens}
        itemContent={(_index, item) => {
          return (
            <SelectTokenListItem
              item={item}
              isSelected={equalTokens(item.token, data.st)}
              onTokenBalanceSelect={onTokenBalanceSelect}
              isConnected={isConnected}
            />
          );
        }}
      />
    </SelectModal>
  );
};
