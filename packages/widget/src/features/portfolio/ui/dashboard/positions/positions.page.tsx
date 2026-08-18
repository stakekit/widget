import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../features/widget-configuration/index";
import { combineRecipeWithVariant } from "../../../../../shared/styles/recipe-variant";
import { VirtualList } from "../../../../../shared/ui/components/virtual-list";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useTrackPage } from "../../../../tracking/index";
import { useSKWallet } from "../../../../wallet/index";
import { ZerionChainModal } from "../../../../wallet/views";
import { FallbackContent } from "../../../../widget-shell/views";
import { usePortfolioBorrowPositions } from "../../../react/use-borrow-positions";
import { usePositions } from "../../../react/use-positions";
import { PositionsListItem } from "./components/positions-list-item";
import { PositionsSectionHeader } from "./components/positions-section-header";
import { useGroupedPositions } from "./hooks/use-grouped-positions";
import { getUnifiedManagePositionsState } from "./model";
import { container, positionsTitle } from "./styles.css";

export const PositionsPage = () => {
  useTrackPage("positions");

  const { positions, positionsResult, showPositions } = usePositions();
  const variant = useWidgetConfig("variant");
  const borrowPositions = usePortfolioBorrowPositions();
  const { isConnected, isConnecting } = useSKWallet();
  const manageState = getUnifiedManagePositionsState({
    borrowPositionsResult: borrowPositions.positionsResult,
    borrowWalletIsConnected:
      borrowPositions.enabled &&
      borrowPositions.connectionStatus === "connected",
    earnIsError: AsyncResult.isFailure(positionsResult),
    earnIsFetching: positionsResult.waiting,
    earnIsLoading: AsyncResult.isInitial(positionsResult),
    earnPositionsCount: positions.length,
    isConnected,
    isConnecting,
    showEarnPositions: showPositions,
  });

  const listData = useGroupedPositions();

  const { t } = useTranslation();
  const content = useMemo(() => {
    if (manageState.isAnyPositionsLoading && isConnected) {
      return <FallbackContent type="spinner" />;
    }
    if (manageState.showConnectWallet) {
      return (
        <Box
          display="flex"
          flex={1}
          justifyContent="center"
          alignItems="center"
        >
          <Text
            variant={{ weight: "medium", size: "large" }}
            textAlign="center"
          >
            {t("dashboard.details.positions_connect_wallet")}
          </Text>
        </Box>
      );
    }
    if (manageState.hasOnlyErrors) {
      return <FallbackContent type="something_wrong" />;
    }

    return null;
  }, [isConnected, manageState, t]);

  return (
    <Box className={container} display="flex" flex={1} flexDirection="column">
      {content}

      {manageState.showPositionsList && (
        <>
          <Box
            my="1"
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            gap="1"
          >
            <Text
              className={combineRecipeWithVariant({
                rec: positionsTitle,
                variant,
              })}
            >
              {t("dashboard.details.my_positions")}
            </Text>

            {!!manageState.totalPositionsCount && (
              <Text variant={{ type: "muted", weight: "normal" }}>
                {t("dashboard.details.positions_active", {
                  count: manageState.totalPositionsCount,
                })}
              </Text>
            )}
          </Box>

          <Box flex={1} display="flex" flexDirection="column">
            {manageState.hasPartialError && (
              <Box marginBottom="2">
                <Text variant={{ type: "danger", weight: "normal" }}>
                  {t("dashboard.details.positions_partial_error")}
                </Text>
              </Box>
            )}

            <VirtualList
              estimateSize={() => 60}
              data={listData}
              itemContent={(_, row) => {
                if (row.kind === "chain-modal") return <ZerionChainModal />;
                if (row.kind === "section") {
                  return (
                    <PositionsSectionHeader
                      category={row.category}
                      count={row.count}
                    />
                  );
                }
                return <PositionsListItem item={row.item} />;
              }}
            />

            {manageState.showEmptyPositions && (
              <Box my="4">
                <FallbackContent type="no_current_positions" />
              </Box>
            )}
          </Box>
        </>
      )}
    </Box>
  );
};
