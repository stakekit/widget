import { useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";

import { Stack, Text, VirtualList } from "../../../../../ui/index";
import { useTrackPage } from "../../../../tracking/index";
import { useSKWallet } from "../../../../wallet/index";
import { ZerionChainModal } from "../../../../wallet/views";
import { usePortfolioBorrowPositions } from "../../../react/use-borrow-positions";
import { usePositions } from "../../../react/use-positions";
import {
  currentGroupedPositionsAtom,
  type PositionsListRow,
} from "../../../state/read-models/positions";
import {
  PositionsConnectWallet,
  PositionsEmpty,
  PositionsLoadFailed,
  PositionsPartiallyLoaded,
  PositionsSkeleton,
} from "../../components/positions-states";
import { RevealBalancesHeader } from "../../components/reveal-balances-header";
import { PositionsListItem } from "./components/positions-list-item";
import { PositionsSectionHeader } from "./components/positions-section-header";
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

  const listData = useAtomValue(currentGroupedPositionsAtom);

  const { t } = useTranslation();
  const renderContent = () => {
    // Keep the list mounted while a source refreshes; only the first load with
    // nothing to show stands in skeleton rows.
    if (
      manageState.isAnyPositionsLoading &&
      isConnected &&
      !manageState.showPositionsList
    ) {
      return <PositionsSkeleton />;
    }
    if (manageState.showConnectWallet) {
      return (
        <PositionsConnectWallet
          title={t("dashboard.details.positions_connect_wallet")}
        />
      );
    }
    if (manageState.hasOnlyErrors) return <PositionsLoadFailed />;

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
            {manageState.hasPartialError && <PositionsPartiallyLoaded />}

            <VirtualList
              label={t("dashboard.details.my_positions")}
              items={listData}
              getKey={positionsListRowKey}
              estimateSize={68}
              maxHeight="lg"
              grow={!manageState.showEmptyPositions}
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

            {manageState.showEmptyPositions && <PositionsEmpty />}
          </Stack>
        </>
      )}
    </Stack>
  );
};
