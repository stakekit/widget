import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box } from "../../../components/atoms/box";
import { Text } from "../../../components/atoms/typography/text";
import { VirtualList } from "../../../components/atoms/virtual-list";
import { ZerionChainModal } from "../../../components/molecules/zerion-chain-modal";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { FallbackContent } from "../../../pages/details/positions-page/components/fallback-content";
import { usePositions } from "../../../pages/details/positions-page/hooks/use-positions";
import { useSettings } from "../../../providers/settings";
import { useSKWallet } from "../../../providers/sk-wallet";
import { combineRecipeWithVariant } from "../../../utils/styles";
import { useBorrowPositions } from "../../borrow/use-borrow-positions";
import { PositionsListItem } from "./components/positions-list-item";
import { PositionsSectionHeader } from "./components/positions-section-header";
import { useGroupedPositions } from "./hooks/use-grouped-positions";
import { getUnifiedManagePositionsState } from "./model";
import { container, positionsTitle } from "./styles.css";

export const PositionsPage = () => {
  useTrackPage("positions");

  const { positionsData, showPositions } = usePositions();
  const settings = useSettings();
  const borrowManageEnabled =
    settings.borrowEnabled && !!settings.dashboardVariant;
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
    earnIsError: positionsData.isError,
    earnIsFetching: positionsData.isFetching,
    earnIsLoading: positionsData.isLoading,
    earnPositionsCount: positionsData.data.length,
    isConnected,
    isConnecting,
    showEarnPositions: showPositions,
  });

  const listData = useGroupedPositions({
    borrowPositions: borrowPositionItems,
    earnPositions: positionsData.data,
  });

  const { t } = useTranslation();
  const { variant } = settings;

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
