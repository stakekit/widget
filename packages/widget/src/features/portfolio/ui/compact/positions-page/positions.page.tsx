import { useTranslation } from "react-i18next";
import { Box, Stack, Text, VirtualList } from "../../../../../ui/index";
import { useTrackPage } from "../../../../tracking/index";
import { useSKWallet } from "../../../../wallet/index";
import { ZerionChainModal } from "../../../../wallet/views";
import {
  FallbackContent,
  MountAnimatedPage,
} from "../../../../widget-shell/views";
import { usePositions } from "../../../react/use-positions";
import { RevealBalancesHeader } from "../../components/reveal-balances-header";
import { PositionsListItem } from "./components/positions-list-item";

const PositionsPage = () => {
  useTrackPage("positions");

  const { positions, positionsView, showPositions } = usePositions();

  const wallet = useSKWallet();
  const isConnected = wallet?.status === "connected";
  const isConnecting = wallet === null || wallet.status === "connecting";

  const { t } = useTranslation();

  const renderContent = () => {
    if (positionsView._tag === "Loading" && isConnected) {
      return <FallbackContent type="spinner" />;
    }
    if (!isConnected && !isConnecting) {
      return (
        <Stack grow justify="end">
          <Stack grow align="center" justify="center">
            <Text variant="heading" as="p" align="center">
              {t("positions.connect_wallet_manage")}
            </Text>
          </Stack>

          <FallbackContent type="not_connected" />
        </Stack>
      );
    }
    if (positionsView._tag === "Failed") {
      return <FallbackContent type="something_wrong" />;
    }

    return null;
  };

  return (
    <Stack grow>
      {renderContent()}

      {showPositions && (
        <Stack grow>
          <ZerionChainModal />

          <RevealBalancesHeader />

          {isConnected && !positions.length && (
            <Box paddingBlock={16}>
              <FallbackContent type="no_current_positions" />
            </Box>
          )}

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
