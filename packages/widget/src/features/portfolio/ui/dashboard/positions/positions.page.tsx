import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../app/config";
import { combineRecipeWithVariant } from "../../../../../shared/styles/recipe-variant";
import { VirtualList } from "../../../../../shared/ui/components/virtual-list";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useBorrowPositions } from "../../../../borrow/positions";
import { useTrackPage } from "../../../../tracking";
import { useSKWallet, ZerionChainModal } from "../../../../wallet";
import { FallbackContent } from "../../../../widget-shell";
import { usePositions } from "../../classic/positions-page/hooks/use-positions";
import { PositionsListItem } from "./components/positions-list-item";
import { PositionsSectionHeader } from "./components/positions-section-header";
import { useGroupedPositions } from "./hooks/use-grouped-positions";
import { getUnifiedManagePositionsState } from "./model";
import { container, positionsTitle } from "./styles.css";

export const PositionsPage = () => {
  useTrackPage("positions");

  const { positions, positionsResult, showPositions } = usePositions();
  const borrowEnabled = useWidgetConfig("borrowEnabled");
  const dashboardVariant = useWidgetConfig("dashboardVariant");
  const variant = useWidgetConfig("variant");
  const borrowManageEnabled = borrowEnabled && !!dashboardVariant;
  const borrowPositions = useBorrowPositions({ enabled: borrowManageEnabled });
  const borrowPositionItems = AsyncResult.getOrElse(
    borrowPositions.positionsResult,
    () => []
  );
  const { isConnected, isConnecting } = useSKWallet();
  const manageState = getUnifiedManagePositionsState({
    borrowPositionsResult: borrowPositions.positionsResult,
    borrowWalletIsConnected:
      borrowManageEnabled &&
      borrowPositions.walletBridge.status === "connected",
    earnIsError: AsyncResult.isFailure(positionsResult),
    earnIsFetching: positionsResult.waiting,
    earnIsLoading: AsyncResult.isInitial(positionsResult),
    earnPositionsCount: positions.length,
    isConnected,
    isConnecting,
    showEarnPositions: showPositions,
  });

  const listData = useGroupedPositions({
    borrowPositions: borrowPositionItems,
    earnPositions: positions,
  });

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
              itemContent={(_, row) =>
                row.kind === "chain-modal" ? (
                  <ZerionChainModal />
                ) : row.kind === "section" ? (
                  <PositionsSectionHeader
                    category={row.category}
                    count={row.count}
                  />
                ) : (
                  <PositionsListItem item={row.item} />
                )
              }
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
