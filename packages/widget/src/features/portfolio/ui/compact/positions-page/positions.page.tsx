import { useTranslation } from "react-i18next";
import { Box, Stack, VirtualList } from "../../../../../ui/index";
import { useTrackPage } from "../../../../tracking/index";
import { useSKWallet } from "../../../../wallet/index";
import { ZerionChainModal } from "../../../../wallet/views";
import { MountAnimatedPage } from "../../../../widget-shell/views";
import { usePositions } from "../../../react/use-positions";
import {
  type PositionItem,
  splitSmallBalances,
} from "../../../state/read-models/positions";
import {
  PositionsConnectWallet,
  PositionsEmpty,
  PositionsLoadFailed,
  PositionsSkeleton,
} from "../../components/positions-states";
import { RevealBalancesHeader } from "../../components/reveal-balances-header";
import { SmallBalances } from "../../components/small-balances";
import { PositionsListItem } from "./components/positions-list-item";
import { PositionsSummary } from "./components/positions-summary";

/** A row of the list: a position, or the small balances collapsed at its end. */
type PositionsRow =
  | { readonly kind: "position"; readonly item: PositionItem }
  | {
      readonly kind: "small-balances";
      readonly items: ReadonlyArray<PositionItem>;
    };

const toPositionsRows = (
  positions: ReadonlyArray<PositionItem>
): ReadonlyArray<PositionsRow> => {
  const { shown, small } = splitSmallBalances(positions);
  const rows: PositionsRow[] = shown.map((item) => ({
    kind: "position",
    item,
  }));
  if (small.length > 0) rows.push({ kind: "small-balances", items: small });
  return rows;
};

const PositionsPage = () => {
  useTrackPage("positions");

  const { positions, positionsView, showPositions } = usePositions();

  const wallet = useSKWallet();
  const isConnected = wallet?.status === "connected";
  const isConnecting = wallet === null || wallet.status === "connecting";

  const { t } = useTranslation();

  const renderContent = () => {
    if (positionsView._tag === "Loading" && isConnected) {
      return <PositionsSkeleton />;
    }
    if (!isConnected && !isConnecting) {
      return (
        <PositionsConnectWallet title={t("positions.connect_wallet_manage")} />
      );
    }
    if (positionsView._tag === "Failed") return <PositionsLoadFailed />;

    return null;
  };

  return (
    <Stack grow>
      {renderContent()}

      {showPositions && (
        <Stack grow>
          <ZerionChainModal />

          {positions.length > 0 && (
            <Box paddingBlock={8}>
              <PositionsSummary />
            </Box>
          )}

          <RevealBalancesHeader />

          {isConnected && !positions.length && <PositionsEmpty />}

          <VirtualList
            label={t("positions.title")}
            items={toPositionsRows(positions)}
            getKey={(row) =>
              row.kind === "position"
                ? `${row.item.integrationId}:${row.item.balanceId}`
                : "small-balances"
            }
            estimateSize={68}
            maxHeight="lg"
            renderItem={(row) =>
              row.kind === "position" ? (
                <PositionsListItem item={row.item} />
              ) : (
                <SmallBalances
                  items={row.items}
                  renderItem={(item) => <PositionsListItem item={item} />}
                />
              )
            }
          />
        </Stack>
      )}
    </Stack>
  );
};

export const AnimatedPositionsPage = () => (
  <MountAnimatedPage>
    <PositionsPage />
  </MountAnimatedPage>
);
