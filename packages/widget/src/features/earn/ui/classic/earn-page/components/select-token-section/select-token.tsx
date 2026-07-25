import { Trigger } from "@radix-ui/react-dialog";
import clsx from "clsx";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../../../app/config/use-widget-config";
import { equalTokens } from "../../../../../../../domain/types/tokens";
import { combineRecipeWithVariant } from "../../../../../../../shared/styles/recipe-variant";
import { SelectModal } from "../../../../../../../shared/ui/components/select-modal";
import { TokenIcon } from "../../../../../../../shared/ui/components/token-icon";
import { VirtualList } from "../../../../../../../shared/ui/components/virtual-list";
import { Box } from "../../../../../../../shared/ui/primitives/box";
import {
  pressAnimation,
  selectTokenButton,
} from "../../../../../../../shared/ui/primitives/button/styles.css";
import { CaretDownIcon } from "../../../../../../../shared/ui/primitives/icons/caret-down";
import { Text } from "../../../../../../../shared/ui/primitives/typography/text";
import { useTrackEvent } from "../../../../../../tracking/state";
import {
  useEarnEntry,
  useEarnTokenSelection,
} from "../../../../../react/use-earn-facades";
import { validatorVirtuosoContainer } from "../../styles.css";
import { SelectTokenListItem } from "./select-token-list-item";

export const SelectToken = ({ canSelect = true }: { canSelect?: boolean }) => {
  const { loadMore, select, setSearch, view } = useEarnTokenSelection();
  const { view: entry } = useEarnEntry();

  const variant = useWidgetConfig("variant");

  const trackEvent = useTrackEvent();

  const { t } = useTranslation();

  const data = useMemo(
    () =>
      entry.selectedToken
        ? { st: entry.selectedToken, tokenBalances: view.filtered }
        : null,
    [entry.selectedToken, view.filtered]
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
      onSearch={setSearch}
      searchValue={view.search}
      onClose={() => setSearch("")}
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
        hasNextPage={view.hasMore}
        isFetchingNextPage={view.isLoadingMore}
        fetchNextPage={() => loadMore(undefined)}
        itemContent={(_index, item) => {
          return (
            <SelectTokenListItem
              item={item}
              isSelected={equalTokens(item.token, data.st)}
              onTokenBalanceSelect={select}
              isConnected={entry.connected}
            />
          );
        }}
      />
    </SelectModal>
  );
};
