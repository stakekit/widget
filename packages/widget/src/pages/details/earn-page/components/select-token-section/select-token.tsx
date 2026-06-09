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
import type { TokenBalanceScanResponseDto } from "../../../../../domain/types/token-balance";
import { equalTokens, tokenString } from "../../../../../domain/types/tokens";
import { useTrackEvent } from "../../../../../hooks/tracking/use-track-event";
import { useSettings } from "../../../../../providers/settings";
import { useSKWallet } from "../../../../../providers/sk-wallet";
import { combineRecipeWithVariant } from "../../../../../utils/styles";
import { useEarnPageContext } from "../../state/earn-page-context";
import { validatorVirtuosoContainer } from "../../styles.css";
import { SelectTokenListItem } from "./select-token-list-item";

const getAvailableYieldsCount = ({
  item,
  selectedDashboardYieldCategory,
  tokenListYieldsIsLoading,
  tokenYieldCountsByToken,
}: {
  item: TokenBalanceScanResponseDto;
  selectedDashboardYieldCategory: unknown;
  tokenListYieldsIsLoading: boolean;
  tokenYieldCountsByToken: ReadonlyMap<string, number>;
}) => {
  if (!selectedDashboardYieldCategory || tokenListYieldsIsLoading) {
    return item.availableYields.length;
  }

  return tokenYieldCountsByToken.get(tokenString(item.token)) ?? 0;
};

export const SelectToken = ({ canSelect = true }: { canSelect?: boolean }) => {
  const {
    onSelectTokenClose,
    onTokenBalanceSelect,
    tokenBalancesData,
    selectedToken,
    onTokenSearch,
    tokenSearch,
    selectedDashboardYieldCategory,
    tokenMaxYieldRatesByToken,
    tokenYieldCountsByToken,
    tokenListYieldsIsLoading,
  } = useEarnPageContext();

  const { variant } = useSettings();

  const trackEvent = useTrackEvent();

  const { t } = useTranslation();

  const { isConnected } = useSKWallet();

  const data = useMemo(
    () =>
      selectedToken
        .map((st) => {
          const tokenBalances =
            tokenBalancesData.map((v) => v.filtered).extract() ?? [];

          return {
            st,
            tokenBalances: tokenBalances.filter(
              (item) =>
                getAvailableYieldsCount({
                  item,
                  selectedDashboardYieldCategory,
                  tokenListYieldsIsLoading,
                  tokenYieldCountsByToken,
                }) > 0
            ),
          };
        })
        .extractNullable(),
    [
      selectedDashboardYieldCategory,
      selectedToken,
      tokenBalancesData,
      tokenListYieldsIsLoading,
      tokenYieldCountsByToken,
    ]
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
      isLoading={!!selectedDashboardYieldCategory && tokenListYieldsIsLoading}
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
        itemContent={(_index, item) => {
          const tokenKey = tokenString(item.token);
          const availableYieldsCount = getAvailableYieldsCount({
            item,
            selectedDashboardYieldCategory,
            tokenListYieldsIsLoading,
            tokenYieldCountsByToken,
          });
          const canSelectToken =
            !selectedDashboardYieldCategory ||
            (!tokenListYieldsIsLoading && availableYieldsCount > 0);

          return (
            <SelectTokenListItem
              item={item}
              isSelected={equalTokens(item.token, data.st)}
              maxYieldRate={tokenMaxYieldRatesByToken.get(tokenKey)}
              availableYieldsCount={availableYieldsCount}
              canSelectToken={canSelectToken}
              onTokenBalanceSelect={onTokenBalanceSelect}
              isConnected={isConnected}
            />
          );
        }}
      />
    </SelectModal>
  );
};
