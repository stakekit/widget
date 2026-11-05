import { useTranslation } from "react-i18next";
import { Box, Stack, VirtualList } from "../../../../../ui/index";
import { useTrackPage } from "../../../../tracking/index";
import { useSKWallet } from "../../../../wallet/index";
import { ZerionChainModal } from "../../../../wallet/views";
import { MountAnimatedPage } from "../../../../widget-shell/views";
import { usePositions } from "../../../react/use-positions";
import {
  PositionsConnectWallet,
  PositionsEmpty,
  PositionsLoadFailed,
  PositionsSkeleton,
} from "../../components/positions-states";
import { RevealBalancesHeader } from "../../components/reveal-balances-header";
import { PositionsListItem } from "./components/positions-list-item";
import { PositionsSummary } from "./components/positions-summary";

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
            items={positions}
            getKey={(item) => `${item.integrationId}:${item.balanceId}`}
            estimateSize={68}
            maxHeight="lg"
            renderItem={(item) => <PositionsListItem item={item} />}
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
