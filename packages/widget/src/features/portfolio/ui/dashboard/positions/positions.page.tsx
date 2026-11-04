import { useTranslation } from "react-i18next";
import { Box, Stack, Text, VirtualList } from "../../../../../ui/index";
import { useTrackPage } from "../../../../tracking/index";
import { useSKWallet } from "../../../../wallet/index";
import { ZerionChainModal } from "../../../../wallet/views";
import { FallbackContent } from "../../../../widget-shell/views";
import { usePortfolioBorrowPositions } from "../../../react/use-borrow-positions";
import { usePositions } from "../../../react/use-positions";
import type { PositionsListRow } from "../../../state/read-models/positions";
import { RevealBalancesHeader } from "../../components/reveal-balances-header";
import { PositionsListItem } from "./components/positions-list-item";
import { PositionsSectionHeader } from "./components/positions-section-header";
import { useGroupedPositions } from "./hooks/use-grouped-positions";
import { getUnifiedManagePositionsState } from "./model";

const positionsListRowKey = (row: PositionsListRow) => {
  if (row.kind === "chain-modal") return "chain-modal";
  if (row.kind === "section") return `section:${row.category}`;
  return row.item.kind === "borrow"
    ? `borrow:${row.item.position.id}`
    : `earn:${row.item.position.integrationId}:${row.item.position.balanceId}`;
};

export const PositionsPage = () => {
  useTrackPage("positions");

  const { positionsView } = usePositions();
  const borrowPositions = usePortfolioBorrowPositions();
  const wallet = useSKWallet();
  const isConnected = wallet?.status === "connected";
  const isConnecting = wallet === null || wallet.status === "connecting";
  const manageState = getUnifiedManagePositionsState({
    borrowPositions: borrowPositions.positions,
    borrowWalletIsConnected:
      borrowPositions.enabled &&
      borrowPositions.connectionStatus === "connected",
    earnPositions: positionsView,
    isConnected,
    isConnecting,
  });

  const listData = useGroupedPositions();

  const { t } = useTranslation();
  const renderContent = () => {
    // Keep the list mounted while a source refreshes; only the first load with
    // nothing to show uses the full-page spinner.
    if (
      manageState.isAnyPositionsLoading &&
      isConnected &&
      !manageState.showPositionsList
    ) {
      return <FallbackContent type="spinner" />;
    }
    if (manageState.showConnectWallet) {
      return (
        <Stack grow align="center" justify="center">
          <Text variant="heading" as="p" align="center">
            {t("dashboard.details.positions_connect_wallet")}
          </Text>
        </Stack>
      );
    }
    if (manageState.hasOnlyErrors) {
      return <FallbackContent type="something_wrong" />;
    }

    return null;
  };

  return (
    <Stack grow>
      {renderContent()}

      {manageState.showPositionsList && (
        <>
          <RevealBalancesHeader
            leading={
              <Text variant="heading" as="h2">
                {t("dashboard.details.my_positions")}
              </Text>
            }
            trailing={
              manageState.totalPositionsCount ? (
                <Text tone="muted">
                  {t("dashboard.details.positions_active", {
                    count: manageState.totalPositionsCount,
                  })}
                </Text>
              ) : null
            }
          />

          <Stack grow gap={8}>
            {manageState.hasPartialError && (
              <Text tone="danger">
                {t("dashboard.details.positions_partial_error")}
              </Text>
            )}

            <VirtualList
              label={t("dashboard.details.my_positions")}
              items={listData}
              getKey={positionsListRowKey}
              estimateSize={68}
              maxHeight="lg"
              renderItem={(row) => {
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
              <Box paddingBlock={16}>
                <FallbackContent type="no_current_positions" />
              </Box>
            )}
          </Stack>
        </>
      )}
    </Stack>
  );
};
