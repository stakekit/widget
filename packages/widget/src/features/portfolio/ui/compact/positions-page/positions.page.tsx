import { useTranslation } from "react-i18next";

import { Box, Stack, VirtualList } from "../../../../../ui/index";
import { useTrackPage } from "../../../../tracking/index";
import { ZerionChainModal } from "../../../../wallet/views";
import { MountAnimatedPage } from "../../../../widget-shell/views";
import { ManageSummary } from "../../components/manage-summary";
import {
  PositionsConnectWallet,
  PositionsEmpty,
  PositionsLoadFailed,
  PositionsSkeleton,
} from "../../components/positions-states";
import { RevealBalancesHeader } from "../../components/reveal-balances-header";
import { useEarnPositionsPage } from "../../use-positions";
import { PositionsListItem } from "./components/positions-list-item";

const PositionsPage = () => {
  useTrackPage("positions");

  const page = useEarnPositionsPage();
  const { t } = useTranslation();

  const renderContent = () => {
    switch (page._tag) {
      case "Disconnected":
        return (
          <PositionsConnectWallet
            title={t("positions.connect_wallet_manage")}
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
          <Stack grow>
            <ZerionChainModal />

            <RevealBalancesHeader />

            {page._tag === "Empty" && <PositionsEmpty />}

            <VirtualList
              label={t("positions.title")}
              items={page.rows}
              getKey={(item) => `${item.integrationId}:${item.balanceId}`}
              estimateSize={68}
              maxHeight="lg"
              renderItem={(item) => <PositionsListItem item={item} />}
            />
          </Stack>
        );
    }
  };

  return (
    <Stack grow>
      {/* Every state with a wallet sums up its positions, as Dashboard does. */}
      {page._tag !== "Disconnected" && page._tag !== "Connecting" && (
        <Box paddingBlock={8}>
          <ManageSummary />
        </Box>
      )}

      {renderContent()}
    </Stack>
  );
};

export const AnimatedPositionsPage = () => (
  <MountAnimatedPage>
    <PositionsPage />
  </MountAnimatedPage>
);
