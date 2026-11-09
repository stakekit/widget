import { useTranslation } from "react-i18next";
import { Stack, Text, VirtualList } from "../../../../../ui/index";
import { useTrackPage } from "../../../../tracking/index";
import { ZerionChainModal } from "../../../../wallet/views";
import { usePortfolioPositionsPage } from "../../../react/use-positions";
import type { PositionsListRow } from "../../../state/read-models/positions";
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

const positionsListRowKey = (row: PositionsListRow) => {
  if (row.kind === "chain-modal") return "chain-modal";
  if (row.kind === "section") return `section:${row.category}`;
  return row.item.kind === "borrow"
    ? `borrow:${row.item.position.id}`
    : `earn:${row.item.position.integrationId}:${row.item.position.balanceId}`;
};

export const PositionsPage = () => {
  useTrackPage("positions");

  const page = usePortfolioPositionsPage();
  const { t } = useTranslation();

  const renderContent = () => {
    switch (page._tag) {
      case "Disconnected":
        return (
          <PositionsConnectWallet
            title={t("dashboard.details.positions_connect_wallet")}
          />
        );
      case "Connecting":
        return null;
      case "Loading":
        return <PositionsSkeleton />;
      case "Failed":
        return <PositionsLoadFailed />;
      case "Empty":
      case "Ready":
        return (
          <>
            <RevealBalancesHeader
              leading={
                <Text variant="heading" as="h2">
                  {t("dashboard.details.my_positions")}
                </Text>
              }
              trailing={
                page._tag === "Ready" && page.total ? (
                  <Text tone="muted">
                    {t("dashboard.details.positions_active", {
                      count: page.total,
                    })}
                  </Text>
                ) : null
              }
            />

            <Stack grow gap={8}>
              {page._tag === "Ready" && page.partialFailure && (
                <PositionsPartiallyLoaded />
              )}

              <VirtualList
                label={t("dashboard.details.my_positions")}
                items={page.rows}
                getKey={positionsListRowKey}
                estimateSize={68}
                maxHeight="lg"
                grow={page._tag === "Ready"}
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

              {page._tag === "Empty" && <PositionsEmpty />}
            </Stack>
          </>
        );
    }
  };

  return <Stack grow>{renderContent()}</Stack>;
};
